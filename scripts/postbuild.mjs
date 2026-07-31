#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, 'dist')
const srcDir = resolve(__dirname)

// 1. 复制 manifest.json 到 dist 根目录
const manifestSrc = resolve(srcDir, 'manifest.json')
const manifestDest = resolve(distDir, 'manifest.json')
copyFileSync(manifestSrc, manifestDest)
console.log('✓ manifest.json 已复制到 dist/')

// 2. 验证 manifest 中的资源路径对应存在
const manifest = JSON.parse(readFileSync(manifestDest, 'utf-8'))
const popupPath = resolve(distDir, manifest.action.default_popup)
const bgPath = resolve(distDir, manifest.background.service_worker)
const csPath = resolve(distDir, manifest.content_scripts[0].js[0])

if (!existsSync(popupPath)) console.warn(`⚠ 警告: popup 入口不存在: ${popupPath}`)
else console.log(`✓ popup 入口: ${popupPath}`)

if (!existsSync(bgPath)) console.warn(`⚠ 警告: background 入口不存在: ${bgPath}`)
else console.log(`✓ background 入口: ${bgPath}`)

if (!existsSync(csPath)) console.warn(`⚠ 警告: content script 入口不存在: ${csPath}`)
else console.log(`✓ content script 入口: ${csPath}`)

console.log('✓ 构建完成，dist 目录已就绪')
