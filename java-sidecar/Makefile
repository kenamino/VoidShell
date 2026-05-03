# VoidShell Java Sidecar Build
SRC_DIR  = src/main/java
OUT_DIR  = out
MAIN     = com.voidshell.VoidSidecar
JAR      = VoidSidecar.jar

.PHONY: all compile run jar clean

all: jar

compile:
	mkdir -p $(OUT_DIR)
	javac -source 11 -target 11 -d $(OUT_DIR) $(SRC_DIR)/com/voidshell/VoidSidecar.java

jar: compile
	jar cfe $(JAR) $(MAIN) -C $(OUT_DIR) .
	@echo "[VoidSidecar] Built: $(JAR)"

run: jar
	java -jar $(JAR)

clean:
	rm -rf $(OUT_DIR) $(JAR)
