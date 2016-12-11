var path          = require('path')
var fs            = require('fs')
var _             = require('lodash')
var handlebars    = require('handlebars')

var Parser = function () {
  this.config = {
    debug: false,
    partialsDir: false
  }
  this.steps = []
}

Parser.prototype.log = function() {
  if(this.config.debug) {
    console.log.apply(this, arguments)
  }
}

Parser.prototype.getPageFiles = function () {
  return fs.readdirSync(this.config.pagesDir)
}

Parser.prototype.registerStep = function (fn) {
  this.steps.push(fn)
}

Parser.prototype.getPartialFiles = function () {
  if(!this.config.partialsDir) {
    return false
  }
  return fs.readdirSync(this.config.partialsDir)
}

Parser.prototype.registerPartials = function () {
  var files = this.getPartialFiles()
  console.log('FILES FILES FILES', files)
  if(!files) {
    return false
  }
  files.forEach(function (file) {
    var filePath = path.join(this.config.partialsDir, file)
    var name = path.basename(filePath, path.extname(filePath))
    handlebars.registerPartial(name, fs.readFileSync(filePath, 'utf8'))
  })  
}

Parser.prototype.init = function (config) {
  for(var k in config) {
    this.config[k] = config[k]
  }
  this.pagesDir = this.gameDataDir
  this.pages = {}
  this.gameData = JSON.parse(fs.readFileSync(this.config.gameDataFile))
  this.registerPartials()
  var pages = this.getPageFiles()
  pages.forEach(function (page) {
    var template = handlebars.compile(fs.readFileSync(path.join(this.config.pagesDir, page), 'utf8'))
    var template2 = handlebars.compile(template(this.gameData))
    this.pages[page] = this.config.header + template2(this.gameData) + this.config.footer
  }.bind(this))
}

Parser.prototype.run = function () {
  for(var name in this.pages) {
    var basename = path.basename(name, path.extname(name))
    var filename =  basename + '.' + this.config.outputExtension
    for(var i = 0; i < this.steps.length; i++) {
      this.pages[name] = this.steps[i](this.pages[name], name)
    }
    fs.writeFileSync(path.join(this.config.outputDir, filename), this.pages[name])
  }
}

module.exports = new Parser()