// Quick API test script
const https = require('http');

function testLogin() {
  const data = JSON.stringify({
    email: 'owner@test.local',
    password: 'password123'
  });

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log('🔑 Testing login...');

  const req = https.request(options, (res) => {
    let body = '';

    res.on('data', (chunk) => {
      body += chunk;
    });

    res.on('end', () => {
      console.log('Status:', res.statusCode);
      const response = JSON.parse(body);

      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('✅ Login successful!');
        console.log('Token:', response.token ? response.token.substring(0, 20) + '...' : 'N/A');
        console.log('User:', response.user?.email);

        // Test tickets endpoint with token
        if (response.token) {
          testTickets(response.token);
        }
      } else {
        console.log('❌ Login failed');
        console.log('Response:', body);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Error:', error.message);
  });

  req.write(data);
  req.end();
}

function testTickets(token) {
  console.log('\n📋 Testing tickets endpoint...');

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/tickets?page=1&limit=10',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = https.request(options, (res) => {
    let body = '';

    res.on('data', (chunk) => {
      body += chunk;
    });

    res.on('end', () => {
      console.log('Status:', res.statusCode);

      if (res.statusCode === 200) {
        const response = JSON.parse(body);
        console.log('✅ Tickets retrieved!');
        console.log('Total tickets:', response.pagination?.total || 'N/A');
        console.log('Current page:', response.pagination?.page || 'N/A');
        console.log('First ticket:', response.data?.[0]?.title || 'N/A');
      } else {
        console.log('❌ Failed to get tickets');
        console.log('Response:', body.substring(0, 200));
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Error:', error.message);
  });

  req.end();
}

// Run tests
testLogin();
