const { Resolver } = require('dns');
const mongoose = require('mongoose');

// 1. Force Node.js to use Google's DNS (8.8.8.8) to bypass your local router/firewall
const resolver = new Resolver();
resolver.setServers(['8.8.8.8']);

console.log('Testing DNS resolution for MongoDB Atlas...');

resolver.resolveSrv('_mongodb._tcp.zline.x9y4d9n.mongodb.net', async (err, addresses) => {
  if (err) {
    console.error('❌ DNS Error (Cluster might be paused/deleted, or aggressive firewall blocking port 53):', err.message);
    return;
  }
  
  console.log('✅ DNS Resolved Successfully! The cluster exists.');
  console.log('Nodes found:', addresses.map(a => a.name));

  console.log('\nNow testing actual database connection...');
  try {
    const MONGO_URI = "mongodb+srv://Zline_Data:932212ms09@zline.x9y4d9n.mongodb.net/?appName=Zline&compressors=zlib";
    await mongoose.connect(MONGO_URI, { family: 4, serverSelectionTimeoutMS: 5000 });
    console.log('✅ Database connected successfully!');
    process.exit(0);
  } catch (dbErr) {
    console.error('❌ Database Connection Error:', dbErr.message);
    process.exit(1);
  }
});
