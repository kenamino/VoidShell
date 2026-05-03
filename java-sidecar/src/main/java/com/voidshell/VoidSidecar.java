package com.voidshell;

import com.sun.management.OperatingSystemMXBean;
import java.io.*;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * VoidShell Java Sidecar
 *
 * A lightweight TCP server that streams real-time system metrics (CPU load,
 * memory usage) as newline-delimited JSON to connected Electron clients.
 *
 * Protocol:
 *   - Listens on TCP port 27182
 *   - Pushes one JSON line per second:
 *     {"cpuLoad":42.5,"memUsed":4294967296,"memTotal":17179869184,"memPercent":25.0,"timestamp":1700000000000}
 *
 * Compile:  javac -d out src/main/java/com/voidshell/VoidSidecar.java
 * Run:      java -cp out com.voidshell.VoidSidecar
 */
public class VoidSidecar {

    private static final int    PORT            = 27182;
    private static final long   PUSH_INTERVAL_MS = 1000L;
    private static final int    MAX_CLIENTS     = 4;

    private final OperatingSystemMXBean osMXBean;
    private final MemoryMXBean          memMXBean;
    private final CopyOnWriteArrayList<PrintWriter> clients = new CopyOnWriteArrayList<>();
    private final AtomicBoolean running = new AtomicBoolean(true);

    // ── Constructor ────────────────────────────────────────────────────────────
    public VoidSidecar() {
        this.osMXBean  = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
        this.memMXBean = ManagementFactory.getMemoryMXBean();
    }

    // ── Entry Point ────────────────────────────────────────────────────────────
    public static void main(String[] args) throws Exception {
        System.out.println("[VoidSidecar] Starting on port " + PORT);
        new VoidSidecar().start();
    }

    public void start() throws Exception {
        // Graceful shutdown hook
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            running.set(false);
            System.out.println("[VoidSidecar] Shutting down.");
        }));

        // Metrics push thread
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "void-metrics-pusher");
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleAtFixedRate(this::pushMetrics, 0, PUSH_INTERVAL_MS, TimeUnit.MILLISECONDS);

        // Accept connections
        try (ServerSocket serverSocket = new ServerSocket(PORT)) {
            serverSocket.setReuseAddress(true);
            System.out.println("[VoidSidecar] Listening for Electron on port " + PORT);

            while (running.get()) {
                try {
                    Socket clientSocket = serverSocket.accept();
                    if (clients.size() >= MAX_CLIENTS) {
                        clientSocket.close();
                        continue;
                    }
                    handleClient(clientSocket);
                } catch (IOException e) {
                    if (running.get()) {
                        System.err.println("[VoidSidecar] Accept error: " + e.getMessage());
                    }
                }
            }
        }
        scheduler.shutdownNow();
    }

    // ── Client Handler ─────────────────────────────────────────────────────────
    private void handleClient(Socket socket) {
        Thread clientThread = new Thread(() -> {
            PrintWriter writer = null;
            try {
                socket.setTcpNoDelay(true);
                socket.setKeepAlive(true);
                writer = new PrintWriter(
                    new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), "UTF-8")),
                    true // auto-flush
                );
                clients.add(writer);
                System.out.println("[VoidSidecar] Client connected: " + socket.getRemoteSocketAddress());

                // Keep alive until client disconnects
                InputStream in = socket.getInputStream();
                while (running.get() && !socket.isClosed()) {
                    if (in.read() == -1) break;
                }
            } catch (IOException e) {
                // Client disconnected
            } finally {
                if (writer != null) {
                    clients.remove(writer);
                }
                try { socket.close(); } catch (IOException ignored) {}
                System.out.println("[VoidSidecar] Client disconnected.");
            }
        }, "void-client-handler");
        clientThread.setDaemon(true);
        clientThread.start();
    }

    // ── Metrics Collection ─────────────────────────────────────────────────────
    private void pushMetrics() {
        if (clients.isEmpty()) return;

        try {
            double cpuLoad    = getCpuLoad();
            long   memUsed    = getMemUsed();
            long   memTotal   = getMemTotal();
            double memPercent = memTotal > 0 ? (memUsed * 100.0 / memTotal) : 0.0;
            long   timestamp  = System.currentTimeMillis();

            // Hand-crafted JSON (no external dependencies)
            String json = String.format(
                "{\"cpuLoad\":%.2f,\"memUsed\":%d,\"memTotal\":%d,\"memPercent\":%.2f,\"timestamp\":%d}",
                cpuLoad, memUsed, memTotal, memPercent, timestamp
            );

            // Broadcast to all clients
            for (PrintWriter writer : clients) {
                try {
                    writer.println(json);
                } catch (Exception e) {
                    clients.remove(writer);
                }
            }
        } catch (Exception e) {
            System.err.println("[VoidSidecar] Metrics error: " + e.getMessage());
        }
    }

    // ── CPU Load ───────────────────────────────────────────────────────────────
    private double getCpuLoad() {
        // getProcessCpuLoad returns 0.0–1.0; multiply by 100 for percentage
        // On first call it may return -1.0 (not yet available)
        double load = osMXBean.getCpuLoad();
        if (load < 0) load = osMXBean.getProcessCpuLoad();
        if (load < 0) load = 0;
        return Math.min(100.0, load * 100.0);
    }

    // ── Memory ─────────────────────────────────────────────────────────────────
    private long getMemUsed() {
        // Heap + non-heap used
        long heap    = memMXBean.getHeapMemoryUsage().getUsed();
        long nonHeap = memMXBean.getNonHeapMemoryUsage().getUsed();

        // Also try OS-level physical memory for more accurate reading
        long physFree  = osMXBean.getFreeMemorySize();
        long physTotal = osMXBean.getTotalMemorySize();
        if (physTotal > 0) {
            return physTotal - physFree;
        }
        return heap + nonHeap;
    }

    private long getMemTotal() {
        long physTotal = osMXBean.getTotalMemorySize();
        if (physTotal > 0) return physTotal;
        // Fallback: Runtime max memory
        return Runtime.getRuntime().maxMemory();
    }
}
