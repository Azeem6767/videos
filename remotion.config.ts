import { Config } from "@remotion/cli/config";

// Render rules from README §7: h264, concurrency 1 (weak single-core machine),
// overwrite outputs so re-renders never prompt.
Config.setCodec("h264");
Config.setCrf(18);
Config.setConcurrency(1); // weak single-core machine: render one frame at a time
Config.setOverwriteOutput(true);
