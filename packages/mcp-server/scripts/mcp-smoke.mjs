/**
 * MCP server smoke test.
 *
 * Spawns a mock Mosaic HTTP server (captures requests, emulates the REST
 * contract), launches the built MCP server against it over stdio, and
 * verifies tool listing and key tool calls end to end.
 *
 * Run with: bun run smoke  (from packages/mcp-server)
 */
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_BIN = path.resolve(__dirname, '../dist/index.js')

const captured = {
  searchQueries: [],
  createBodies: [],
  uploadFields: [],
  loginCount: 0,
  meCount: 0,
  settingsCount: 0,
}

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function respond(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function startMockServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const pathname = url.pathname

      if (req.method === 'POST' && pathname === '/api/auth/login') {
        captured.loginCount += 1
        return respond(res, 200, {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          user: { id: 'u1', username: 'admin', role: 'admin', createdAt: 1, updatedAt: 1 },
          mustChangePassword: false,
        })
      }
      if (req.method === 'POST' && pathname === '/api/auth/refresh') {
        return respond(res, 200, {
          accessToken: 'mock-access-token-2',
          refreshToken: 'mock-refresh-token-2',
        })
      }
      if (req.method === 'GET' && pathname === '/health') {
        return respond(res, 200, { status: 'ok', version: '0.0.0' })
      }
      if (req.method === 'GET' && pathname === '/api/auth/me') {
        captured.meCount += 1
        return respond(res, 200, {
          id: 'u1',
          username: 'admin',
          role: 'admin',
          mustChangePassword: false,
          createdAt: 1,
          updatedAt: 1,
        })
      }
      if (req.method === 'GET' && pathname === '/api/memos/search') {
        captured.searchQueries.push({
          entries: [...url.searchParams.entries()],
          tagsAll: url.searchParams.getAll('tags'),
          isArchived: url.searchParams.get('isArchived'),
        })
        return respond(res, 200, {
          memos: [],
          total: 0,
          page: 1,
          pageSize: 50,
          semanticEnabled: false,
        })
      }
      if (req.method === 'POST' && pathname === '/api/memos') {
        let body = ''
        req.on('data', chunk => (body += chunk))
        req.on('end', () => {
          captured.createBodies.push(JSON.parse(body))
          respond(res, 201, {
            id: 'm1',
            content: JSON.parse(body).content,
            tags: JSON.parse(body).tags ?? [],
            isArchived: false,
            createdAt: 1,
            updatedAt: 1,
            revisionCount: 1,
            resources: [],
          })
        })
        return
      }
      if (req.method === 'POST' && pathname === '/api/resources/upload') {
        let body = ''
        req.on('data', chunk => (body += chunk))
        req.on('end', () => {
          captured.uploadFields.push({
            contentType: req.headers['content-type'],
            body,
          })
          respond(res, 200, {
            id: 'r1',
            memoId: null,
            filename: 'pixel.png',
            resourceType: 'image',
            mimeType: 'image/png',
            fileSize: 68,
            storageType: 'local',
            url: '/api/resources/r1/download',
            thumbnailUrl: null,
            metadata: { width: 1, height: 1 },
            createdAt: 1,
          })
        })
        return
      }
      if (req.method === 'GET' && pathname === '/admin/api/settings') {
        captured.settingsCount += 1
        return respond(res, 200, {
          autoTagEnabled: true,
          autoSummaryEnabled: false,
          autoDiaryEnabled: true,
          autoDiaryMinMemos: 2,
          autoDiaryMinChars: 150,
          appTimezone: 'Asia/Shanghai',
        })
      }
      if (req.method === 'GET' && pathname === '/api/memos/tags') {
        return respond(res, 200, [])
      }
      if (req.method === 'PUT' && pathname.startsWith('/api/memos/')) {
        return respond(res, 200, { id: 'm1', content: 'ok' })
      }
      if (req.method === 'DELETE' && pathname.startsWith('/api/memos/')) {
        return respond(res, 200, {})
      }

      respond(res, 404, { error: 'Not Found', message: `no mock for ${req.method} ${pathname}` })
    })

    server.listen(0, '127.0.0.1', () => {
      resolve(server)
    })
    server.on('error', reject)
  })
}

function startMcpServer(serverUrl) {
  return new StdioClientTransport({
    command: 'node',
    args: [SERVER_BIN],
    env: {
      ...process.env,
      MOSAIC_SERVER_URL: serverUrl,
      MOSAIC_USERNAME: 'admin',
      MOSAIC_PASSWORD: 'test-password',
    },
    stderr: 'inherit',
  })
}

let failures = 0
function check(name, condition, detail = '') {
  const status = condition ? 'PASS' : 'FAIL'
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (!condition) failures += 1
}

async function main() {
  const mock = await startMockServer()
  const port = mock.address().port
  const serverUrl = `http://127.0.0.1:${port}`
  console.log(`mock Mosaic server on ${serverUrl}`)

  const transport = startMcpServer(serverUrl)
  const client = new Client({ name: 'mcp-smoke', version: '0.1.0' })
  await client.connect(transport)

  try {
    const { tools } = await client.listTools()
    const toolNames = tools.map(t => t.name)
    check(`tools/list returns ${tools.length} tools`, tools.length >= 50, `${tools.length}`)
    const expected = [
      'memos_search',
      'memos_detail',
      'memos_by_date',
      'memos_revisions',
      'memos_delete_revision',
      'resources_upload',
      'auth_me',
      'bots_get',
      'bots_create',
      'bots_reorder',
      'admin_settings_get',
      'admin_settings_update',
      'admin_health',
      'admin_activity',
    ]
    for (const name of expected) {
      check(`tool ${name} registered`, toolNames.includes(name))
    }

    // Login flow exercised on first authenticated call
    const me = await client.callTool({ name: 'auth_me', arguments: {} })
    check('auth_me calls login flow + /api/auth/me', captured.loginCount === 1 && captured.meCount === 1)
    check(
      'auth_me returns user',
      me.content.some(c => typeof c.text === 'string' && c.text.includes('"role": "admin"'))
    )

    // Regression: tags must be sent as repeated query params, not "a,b"
    await client.callTool({
      name: 'memos_search',
      arguments: { query: 'hello', tags: ['work', 'api'], isArchived: true },
    })
    const q = captured.searchQueries[0]
    check(
      'memos_search sends repeated tags params',
      q.tagsAll.length === 2 && q.tagsAll[0] === 'work' && q.tagsAll[1] === 'api',
      JSON.stringify(q.entries)
    )
    check('memos_search sends isArchived=true', q.isArchived === 'true', JSON.stringify(q.entries))

    const created = await client.callTool({
      name: 'memos_create',
      arguments: { content: 'smoke test memo', tags: ['test'] },
    })
    check(
      'memos_create posts content',
      captured.createBodies[0]?.content === 'smoke test memo' &&
        captured.createBodies[0]?.tags?.[0] === 'test',
      JSON.stringify(captured.createBodies[0])
    )
    check(
      'memos_create returns memo',
      created.content.some(c => typeof c.text === 'string' && c.text.includes('"content": "smoke test memo"'))
    )

    const uploaded = await client.callTool({
      name: 'resources_upload',
      arguments: {
        filename: 'pixel.png',
        mimeType: 'image/png',
        dataBase64: PNG_1PX,
        metadata: { width: 1, height: 1 },
      },
    })
    check(
      'resources_upload sends multipart',
      captured.uploadFields.length === 1 &&
        captured.uploadFields[0].contentType.startsWith('multipart/form-data') &&
        captured.uploadFields[0].body.includes('pixel.png') &&
        captured.uploadFields[0].body.includes('width'),
      captured.uploadFields[0]?.contentType ?? 'no upload seen'
    )
    check(
      'resources_upload returns resource',
      uploaded.content.some(c => typeof c.text === 'string' && c.text.includes('"filename": "pixel.png"'))
    )

    const settings = await client.callTool({ name: 'admin_settings_get', arguments: {} })
    check('admin_settings_get works', captured.settingsCount === 1)
    check(
      'admin_settings_get returns settings',
      settings.content.some(c => typeof c.text === 'string' && c.text.includes('"appTimezone": "Asia/Shanghai"'))
    )

    // Tools with no arguments must not crash (schema-less handlers)
    const tags = await client.callTool({ name: 'memos_tags', arguments: {} })
    check('memos_tags (no-arg tool) works', tags.content.length > 0)
  } finally {
    await client.close()
    mock.close()
  }

  if (failures === 0) {
    console.log('\nSMOKE TEST PASSED')
  } else {
    console.log(`\nSMOKE TEST FAILED (${failures} failure(s))`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('SMOKE TEST ERROR:', err)
  process.exit(1)
})
