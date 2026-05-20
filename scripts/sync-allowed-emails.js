#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const PARAM_NAME = '/socioscope/allowed-emails'

const emails = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'allowed-emails.json'), 'utf8')
).map((e) => String(e).trim().toLowerCase()).filter(Boolean)

if (emails.length === 0) {
  console.error('allowed-emails.json is empty — refusing to overwrite parameter')
  process.exit(1)
}

const value = emails.join(',')

try {
  execFileSync(
    'aws',
    ['ssm', 'put-parameter',
      '--name', PARAM_NAME,
      '--type', 'StringList',
      '--overwrite',
      '--value', value],
    { stdio: 'inherit' }
  )
  console.log(`Synced ${emails.length} address(es) to ${PARAM_NAME}`)
} catch (err) {
  console.error('Failed to sync to SSM. Is the AWS CLI configured?')
  process.exit(1)
}
