var path          = require('path')
var fs            = require('fs')
var _             = require('lodash')
var handlebars    = require('handlebars')

var Parser = function () {
  this.config = {
    debug: false
  }
}

Parser.prototype.log = function() {
  if(this.config.debug) {
    console.log.apply(this, arguments)
  }
}

Parser.prototype.getPageFiles = function () {
  return fs.readdirSync(this.config.pagesDir)
}

Parser.prototype.init = function (config) {
  for(var k in config) {
    this.config[k] = config[k]
  }
  this.pagesDir = this.gameDataDir
  this.pages = {}
  this.gameData = JSON.parse(fs.readFileSync(this.config.gameDataFile))
  var pages = this.getPageFiles()
  pages.forEach(function (page) {
    var template = handlebars.compile(fs.readFileSync(path.join(this.config.pagesDir, page), 'utf8'))
    this.pages[page] = this.config.header + template(this.gameData) + this.config.footer
  }.bind(this))
}

Parser.prototype.run = function () {
  for(var name in this.pages) {
    console.log('name', name)
    var basename = path.basename(name, path.extname(name))
    var filename =  basename + '.' + this.config.outputExtension
    console.log('basename', basename)
    console.log('filename', filename)
    fs.writeFileSync(path.join(this.config.outputDir, filename), this.pages[name])
  }
}

module.exports = new Parser()