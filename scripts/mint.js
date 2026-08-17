// Mint a ticket to the caller (the connected signer pays `ticketPrice`).
//
// Usage:
//   npx hardhat run scripts/mint.js --network sepolia
//   CONTRACT_ADDRESS=0x... npx hardhat run scripts/mint.js --network sepolia
const hre = require("hardhat");
const { loadContractAddress } = require("./lib/loadDeployment");

async function main() {
  const address = loadContractAddress(hre);
  const [signer] = await hre.ethers.getSigners();

  const ticket = await hre.ethers.getContractAt("EventTicket", address, signer);
  const price = await ticket.ticketPrice();

  console.log(`Minting a ticket from ${address} as ${signer.address} for ${hre.ethers.formatEther(price)} ETH...`);
  const tx = await ticket.mint({ value: price });
  const receipt = await tx.wait();

  const mintedEvent = receipt.logs
    .map((log) => {
      try {
        return ticket.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e) => e && e.name === "TicketMinted");

  const tokenId = mintedEvent ? mintedEvent.args.tokenId.toString() : "(unknown)";
  console.log(`✅ Minted ticket #${tokenId} to ${signer.address}`);
  console.log(`   Tx: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
