const { Builder } = require("selenium-webdriver");

async function buildDriver() {
  return await new Builder().forBrowser("chrome").build();
}

module.exports = { buildDriver };
