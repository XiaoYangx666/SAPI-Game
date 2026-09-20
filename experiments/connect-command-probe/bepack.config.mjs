export default {
  name: "BEGame Connect Command Probe",
  version: "0.2.0",
  description: "Tests custom command responses over Bedrock /connect",
  target: "1.26.50",
  packs: {
    bp: {
      root: "bp",
      uuid: "5743b0db-69b1-447f-929f-18aed7bec8ee",
      moduleUuid: "a770ed6d-388b-404a-b881-15e6bb1d5763",
      compile: {
        entry: "src/main.ts",
        tsconfig: "tsconfig.json",
        useNpx: true,
        external: ["@minecraft/server"],
      },
      dependencies: { "@minecraft/server": "2.10.0" },
      manifest: { minEngineVersion: "1.26.50" },
    },
  },
  copy: {
    defaultTarget: "win",
    name: { bp: "begame-connect-command-probe-0.1.0" },
  },
  pack: { name: "BEGame-Connect-Command-Probe-{version}", outDir: "dist" },
};
