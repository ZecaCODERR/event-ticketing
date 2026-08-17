// Transfer a ticket you own to another address.
//
// Usage:
//   TOKEN_ID=1 TO=0xRecipient npx hardhat run scripts/transfer.js --network sepolia
const hre = require("hardhat");
const { loadContractAddress } = require("./lib/loadDeployment");

async function main() {
  const { TOKEN_ID, TO } = process.env;
  if (!TOKEN_ID || !TO) {
    throw new Error("Set TOKEN_ID and TO env vars, e.g. TOKEN_ID=1 TO=0x... npx hardhat run scripts/transfer.js --network sepolia");
  }

  const address = loadContractAddress(hre);
  const [signer] = await hre.ethers.getSigners();
  const ticket = await hre.ethers.getContractAt("EventTicket", address, signer);

  const owner = await ticket.ownerOf(TOKEN_ID);
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer ${signer.address} does not own ticket #${TOKEN_ID} (owned by ${owner})`);
  }

  console.log(`Transferring ticket #${TOKEN_ID} from ${signer.address} to ${TO}...`);
  const tx = await ticket["safeTransferFrom(address,address,uint256)"](signer.address, TO, TOKEN_ID);
  await tx.wait();

  console.log(`✅ Transferred. Tx: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
