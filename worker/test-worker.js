const axios = require('axios');

// Simple test script to verify worker is working
async function testWorker() {
  const workerUrl = 'http://localhost:8000';
  
  try {
    console.log('Testing ShardFS Worker...\n');
    
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const health = await axios.get(`${workerUrl}/health`);
    console.log('✅ Health check passed:', health.data);
    
    // Test chunks endpoint
    console.log('\n2. Testing chunks endpoint...');
    const chunks = await axios.get(`${workerUrl}/chunks`);
    console.log('✅ Chunks endpoint working:', chunks.data);
    
    // Test upload endpoint (with dummy data)
    console.log('\n3. Testing upload endpoint...');
    const testChunk = Buffer.from('Hello ShardFS! This is a test chunk.');
    const uploadResponse = await axios.post(`${workerUrl}/uploadChunk`, testChunk, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-chunk-id': 'test-chunk-123',
        'x-filename': 'test.txt',
        'x-chunk-index': '0',
        'x-chunk-size': testChunk.length.toString(),
        'x-total-size': testChunk.length.toString()
      }
    });
    console.log('✅ Upload test passed:', uploadResponse.data);
    
    // Test download endpoint
    console.log('\n4. Testing download endpoint...');
    const downloadResponse = await axios.get(`${workerUrl}/downloadChunk/test-chunk-123`, {
      responseType: 'arraybuffer'
    });
    const downloadedData = Buffer.from(downloadResponse.data);
    console.log('✅ Download test passed. Data:', downloadedData.toString());
    
    console.log('\n🎉 All tests passed! Worker is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testWorker();
