const { withGradleProperties } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withGradle8(config) {
  return withGradleProperties(config, (config) => {
    const wrapperPath = path.join(
      config.modRequest.platformProjectRoot,
      "gradle",
      "wrapper",
      "gradle-wrapper.properties",
    );

    if (fs.existsSync(wrapperPath)) {
      let content = fs.readFileSync(wrapperPath, "utf8");
      content = content.replace(/gradle-\d+\.\d+(\.\d+)?-bin\.zip/, "gradle-8.13-bin.zip");
      fs.writeFileSync(wrapperPath, content);
    }

    return config;
  });
};
