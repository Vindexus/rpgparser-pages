var path          = require('path')
var fs            = require('fs')
var _             = require('lodash')
var handlebars    = require('handlebars')

var Parser = function () {
  this.defaultConfig = {
    debug: false,
    partialsDir: false,
    pagesOnly: false,
    header: '',
    footer: ''
  }
  this.steps = []
}

Parser.prototype.log = function() {
  if(this.config.debug) {
    console.log.apply(this, arguments)
  }
}

Parser.prototype.getPageFiles = function () {
  var readDir = fs.readdirSync(this.config.pagesDir)
  var files = readDir.filter(function (file) {
    var filename = path.basename(file)
    if(!this.config.pagesOnly || this.config.pagesOnly.indexOf(filename) >= 0) {
      return true
    }
    return false
  }.bind(this))

  return files
}

Parser.prototype.registerHelpers = function () {
  if(this.config.helperFiles) {
    this.config.helperFiles.forEach(function (file) {
      this.registerHelperFile(file)
    }.bind(this))
  }
}

Parser.prototype.registerHelperFile = function (file) {
  require(file)(handlebars, this.gameData)
}

Parser.prototype.registerStep = function (fn, config) {
  this.steps.push({
    fn: fn,
    config: config
  })
}

Parser.prototype.registerPackagedStep = function (stepName, config) {
  this.steps.push({
    fn: require('./steps/' + stepName),
    config: config
  })
}

Parser.prototype.getPartialFiles = function () {
  if(!this.config.partialsDir) {
    return false
  }
  return fs.readdirSync(this.config.partialsDir)
}

Parser.prototype.registerPartials = function () {
  var files = this.getPartialFiles()
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
  this.config = JSON.parse(JSON.stringify(this.defaultConfig))
  for(var k in config) {
    this.config[k] = config[k]
  }
  this.pagesDir = this.gameDataDir
  this.pages = {}
  this.gameData = JSON.parse(fs.readFileSync(this.config.gameDataFile))
  this.registerHelpers()
  this.registerPartials()
  var pages = this.getPageFiles()
  pages.forEach(function (page) {
    var template = handlebars.compile(fs.readFileSync(path.join(this.config.pagesDir, page), 'utf8'))
    var template2 = handlebars.compile(template(this.gameData))
    this.pages[page] = template2(this.gameData)
  }.bind(this))
}

//Runs a registered step, and continues to the next if it exits
//When it's done with the last step it runs the doneSteps callback function
Parser.prototype.runStep = function (i, name, filename, doneSteps) {
  if(!this.steps[i]) {
    doneSteps(name, filename)
  }
  this.steps[i].fn(this.pages[name], name, this.steps[i].config, function (content) {
    this.pages[name] = content
    if(i < this.steps.length - 1) {
      this.runStep(i+1, name, filename, doneSteps)
    }
    else {
      doneSteps(name, filename)
    }
  }.bind(this))
}

Parser.prototype.run = function () {
  for(var name in this.pages) {
    var basename = path.basename(name, path.extname(name))
    var filename =  basename + '.' + this.config.outputExtension
    this.runStep(0, name, filename, function (name, filename) {
      fs.writeFileSync(path.join(this.config.outputDir, filename), this.config.header + this.pages[name] + this.config.footer)
    }.bind(this))
  }
}

module.exports = Parser