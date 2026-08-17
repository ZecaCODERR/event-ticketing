const fs = require("fs");
const path = require("path");

/**
 * Load the saved deployment address for the current Hardhat network,
 * falling back to CONTRACT_ADDRESS from the environment.
 */
function loadContractAddress(hre) {
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS;

  const file = path.join(__dirname, "..", "..", "deployments", `${hre.network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No deployment found for network "${hre.network.name}". Run scripts/deploy.js first, ` +
        `or set CONTRACT_ADDRESS in your environment.`
    );
  }
  const { address } = JSON.parse(fs.readFileSync(file, "utf8"));
  return address;
}

module.exports = { loadContractAddress };
