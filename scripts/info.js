// Print event/contract info and, if OWNER env var is set, that address's tickets.
//
// Usage:
//   npx hardhat run scripts/info.js --network sepolia
//   OWNER=0x... npx hardhat run scripts/info.js --network sepolia
const hre = require("hardhat");
const { loadContractAddress } = require("./lib/loadDeployment");

async function main() {
  const address = loadContractAddress(hre);
  const [signer] = await hre.ethers.getSigners();
  const ticket = await hre.ethers.getContractAt("EventTicket", address, signer);

  const [name, symbol, maxSupply, totalMinted, remaining, price, maxPerWallet, mintStart, mintEnd] =
    await Promise.all([
      ticket.name(),
      ticket.symbol(),
      ticket.maxSupply(),
      ticket.totalMinted(),
      ticket.remainingSupply(),
      ticket.ticketPrice(),
      ticket.maxPerWallet(),
      ticket.mintStart(),
      ticket.mintEnd(),
    ]);

  console.log(`Contract: ${address} (network: ${hre.network.name})`);
  console.log(`Event:    ${name} (${symbol})`);
  console.log(`Price:    ${hre.ethers.formatEther(price)} ETH`);
  console.log(`Supply:   ${totalMinted}/${maxSupply} minted (${remaining} remaining)`);
  console.log(`Limit:    ${maxPerWallet} per wallet`);
  console.log(`Window:   ${new Date(Number(mintStart) * 1000).toISOString()} -> ${new Date(Number(mintEnd) * 1000).toISOString()}`);

  const owner = process.env.OWNER;
  if (owner) {
    const balance = await ticket.balanceOf(owner);
    console.log(`\n${owner} owns ${balance} ticket(s).`);
    const owned = [];
    const total = await ticket.totalMinted();
    for (let id = 1n; id <= total; id++) {
      try {
        const o = await ticket.ownerOf(id);
        if (o.toLowerCase() === owner.toLowerCase()) owned.push(id.toString());
      } catch {
        // burned/nonexistent
      }
    }
    console.log(`Token IDs: [${owned.join(", ")}]`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
