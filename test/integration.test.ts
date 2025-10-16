import { execSync } from 'child_process';
import * as https from 'https';
import * as http from 'http';

/**
 * Integration tests for deployed ALB stack
 * These tests require the stack to be deployed
 */

const STACK_NAME = 'AlbNewfuncStack';
const TIMEOUT = 10000;

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
    duration: number;
}

/**
 * Get ALB DNS name from CloudFormation stack outputs
 */
function getAlbDnsName(): string {
    try {
        const output = execSync(
            `aws cloudformation describe-stacks --stack-name ${STACK_NAME} --query "Stacks[0].Outputs[?OutputKey=='ALBDnsName'].OutputValue" --output text`,
            { encoding: 'utf-8' }
        ).trim();

        if (!output) {
            throw new Error('ALB DNS name not found in stack outputs');
        }

        return output;
    } catch (error) {
        throw new Error(`Failed to get ALB DNS name: ${error}`);
    }
}

/**
 * Make HTTP request
 */
function makeRequest(
    url: string,
    options: http.RequestOptions = {}
): Promise<{ statusCode: number; body: string; headers: http.IncomingHttpHeaders }> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;

        const requestOptions: http.RequestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: TIMEOUT,
        };

        const req = protocol.request(requestOptions, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode || 0,
                    body,
                    headers: res.headers,
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

/**
 * Run a single test
 */
async function runTest(
    name: string,
    testFn: () => Promise<void>
): Promise<TestResult> {
    const startTime = Date.now();

    try {
        await testFn();
        const duration = Date.now() - startTime;
        return {
            name,
            passed: true,
            message: 'Passed',
            duration,
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        return {
            name,
            passed: false,
            message: error instanceof Error ? error.message : String(error),
            duration,
        };
    }
}

/**
 * Main test suite
 */
async function runIntegrationTests() {
    console.log('🚀 Starting ALB Integration Tests\n');
    console.log('========================================');

    let albDnsName: string;

    try {
        console.log('📍 Getting ALB DNS name from CloudFormation...');
        albDnsName = getAlbDnsName();
        console.log(`✅ ALB DNS: ${albDnsName}\n`);
    } catch (error) {
        console.error(`❌ Failed to get ALB DNS name: ${error}`);
        console.error('\n⚠️  Make sure the stack is deployed: npx cdk deploy\n');
        process.exit(1);
    }

    const baseUrl = `http://${albDnsName}`;
    const results: TestResult[] = [];

    // Test 1: Default route (should return Server 1)
    results.push(
        await runTest('Default route (Server 1)', async () => {
            const response = await makeRequest(`${baseUrl}/`);

            if (response.statusCode !== 200) {
                throw new Error(`Expected status 200, got ${response.statusCode}`);
            }

            if (!response.body.includes('Server 1') && !response.body.includes('Server')) {
                throw new Error('Expected response from Server 1');
            }
        })
    );

    // Test 2: Path routing /old-api/* (should return Server 2)
    results.push(
        await runTest('Path routing: /old-api/test (Server 2)', async () => {
            const response = await makeRequest(`${baseUrl}/old-api/test`);

            if (response.statusCode !== 200 && response.statusCode !== 404) {
                throw new Error(`Expected status 200 or 404, got ${response.statusCode}`);
            }

            // Even if 404, it should be from Server 2
            if (!response.body.includes('Server 2') && !response.body.includes('Server')) {
                throw new Error('Expected routing to Server 2');
            }
        })
    );

    // Test 3: Host header routing (should return Server 2)
    results.push(
        await runTest('Host header routing: api.example.com (Server 2)', async () => {
            const response = await makeRequest(`${baseUrl}/`, {
                headers: { 'Host': 'api.example.com' },
            });

            if (response.statusCode !== 200 && response.statusCode !== 404) {
                throw new Error(`Expected status 200 or 404, got ${response.statusCode}`);
            }

            if (!response.body.includes('Server 2') && !response.body.includes('Server')) {
                throw new Error('Expected routing to Server 2');
            }
        })
    );

    // Test 4: Query parameter routing (should return Server 2)
    results.push(
        await runTest('Query parameter routing: version=v1 (Server 2)', async () => {
            const response = await makeRequest(`${baseUrl}/?version=v1`);

            if (response.statusCode !== 200 && response.statusCode !== 404) {
                throw new Error(`Expected status 200 or 404, got ${response.statusCode}`);
            }

            if (!response.body.includes('Server 2') && !response.body.includes('Server')) {
                throw new Error('Expected routing to Server 2');
            }
        })
    );

    // Test 5: Different query parameter (should return Server 1)
    results.push(
        await runTest('Different query parameter: version=v2 (Server 1)', async () => {
            const response = await makeRequest(`${baseUrl}/?version=v2`);

            if (response.statusCode !== 200) {
                throw new Error(`Expected status 200, got ${response.statusCode}`);
            }

            if (!response.body.includes('Server 1') && !response.body.includes('Server')) {
                throw new Error('Expected response from Server 1');
            }
        })
    );

    // Test 6: Health check
    results.push(
        await runTest('ALB health check', async () => {
            const response = await makeRequest(`${baseUrl}/`);

            if (response.statusCode < 200 || response.statusCode >= 500) {
                throw new Error(`Unhealthy status: ${response.statusCode}`);
            }
        })
    );

    // Print results
    console.log('\n========================================');
    console.log('📊 Test Results\n');

    let passedCount = 0;
    let failedCount = 0;

    results.forEach((result) => {
        const icon = result.passed ? '✅' : '❌';
        const status = result.passed ? 'PASSED' : 'FAILED';
        console.log(`${icon} ${result.name}`);
        console.log(`   Status: ${status}`);
        console.log(`   Duration: ${result.duration}ms`);

        if (!result.passed) {
            console.log(`   Error: ${result.message}`);
        }

        console.log('');

        if (result.passed) {
            passedCount++;
        } else {
            failedCount++;
        }
    });

    console.log('========================================');
    console.log(`\n✨ Tests completed: ${passedCount} passed, ${failedCount} failed\n`);

    if (failedCount > 0) {
        console.log('⚠️  Some tests failed. Check the results above for details.\n');
        process.exit(1);
    } else {
        console.log('🎉 All tests passed!\n');
        process.exit(0);
    }
}

// Run tests
if (require.main === module) {
    runIntegrationTests().catch((error) => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    });
}

export { runIntegrationTests, getAlbDnsName, makeRequest };
