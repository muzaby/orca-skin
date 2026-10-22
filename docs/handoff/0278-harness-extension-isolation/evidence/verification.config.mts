export default {
  test: {
    include: [
      "docs/handoff/0278-harness-extension-isolation/evidence/native-isolation.test.ts",
    ],
    environment: "node",
    maxWorkers: 1,
  },
};
