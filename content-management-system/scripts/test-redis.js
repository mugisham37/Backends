import Redis from 'ioredis';

async function testRedisConnection() {
  console.log('🔍 Testing Redis connection...');
  
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });

  try {
    // Test connection
    await redis.connect();
    console.log('✅ Redis connection successful!');
    
    // Test basic operations
    await redis.set('test-key', 'Hello from Node.js!');
    const value = await redis.get('test-key');
    console.log(`✅ Redis set/get test: ${value}`);
    
    // Test expiration
    await redis.setex('temp-key', 5, 'This will expire in 5 seconds');
    console.log('✅ Redis expiration test set');
    
    // Get Redis info
    const info = await redis.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
    console.log(`✅ Redis version: ${version}`);
    
    await redis.disconnect();
    console.log('✅ Redis connection closed successfully');
    
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Make sure Redis is installed: sudo apt install redis-server');
    console.log('2. Start Redis service: sudo service redis-server start');
    console.log('3. Check Redis status: sudo service redis-server status');
    console.log('4. Test Redis CLI: redis-cli ping');
    console.log('5. Check if port 6379 is open: netstat -tlnp | grep 6379');
  }
}

testRedisConnection();