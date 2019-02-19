const { promisify } = require('util')
const fs = require('fs')
const rimraf = require('rimraf')
const consola = require('consola')
const ncp = require('ncp')
const tmp  = require('tmp-promise')
const asyncRimRaf = promisify(rimraf)
const asyncNcp = promisify(ncp)

const generateIcons = require('./lib/generate-icons')
const generateBuildFile = require('./lib/generate-build-file')
const { generateAssetLinksFile } = require('./lib/generate-asset-links-file')

const moduleRoot = __dirname

module.exports = function nuxtTwa (options) {
  const { rootDir } = this.nuxt.options
  const pckg = require(rootDir + '/package.json')
  const defaultOptions = {
    applicationId: `com.${pckg.name}.${pckg.name}`,
    launcherName: pckg.name,
    versionCode: Number(String(pckg.version).replace(/\./g, '')),
    versionName: pckg.version,
    iconPath: '/static/icon.png'
  }
  
  this.nuxt.hook('build:before', async () => {
    if (!options.defaultUrl || !options.hostName) {
      if (!options.defaultUrl) consola.error('Nuxt TWA: defaultUrl is required')
      if (!options.hostName) consola.error('Nuxt TWA: hostName is required')
      
      return
    }
    
    options = {
      ...defaultOptions,
      ...options,
    }

    let tempDir
    let tmpRes
    
    try {
      tmpRes = await tmp.dir()
      tempDir = tmpRes.path + '/android'
    } catch (err) {
      return consola.error('Temperary directory generation failed:', err)
    }

    try {
      await asyncNcp(moduleRoot + '/android', tempDir)
    } catch (err) {
      return consola.error('Temporary directory copy failed', err)
    }

    try {
      await generateBuildFile(options, tempDir + '/app/build.gradle')
      consola.success('TWA build.gradle generated')
    } catch (err) {
      return consola.error('Generating build file failed', err)
    }

    try {
      const iconPath = rootDir + options.iconPath
      const androidIconsPath = tempDir + '/app/src/main/res'
      await generateIcons(iconPath, androidIconsPath, rootDir)
    } catch (err) {
      return consola.error('Generating icons failed', err)
    }  

    try {
      await asyncNcp(tempDir, rootDir + '/android')
      asyncRimRaf(tempDir)
    } catch (err) {
      return consola.log('Copy temporary directory to root failed', err)
    }
  })

  this.nuxt.hook('build:done', () => {
    generateAssetLinksFile(options, rootDir + '/.nuxt/dist/client')
  })

  this.nuxt.hook('generate:done', () => {
    generateAssetLinksFile(options, rootDir + '/dist')
  })
}

module.exports.meta = require('./package.json')
