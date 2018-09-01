var path              = require('path')
var fs                = require('fs')
var _                 = require('lodash')
var handlebars        = require('handlebars')
var async             = require('async');

var args = {}; //TODO: These should be passed in from somewhere else. This file is no longer a command line thing.

var Parser = function () {
  this.defaultConfig = {
    debug: false,
    partialsDirs: false,
    pagesOnly: false,
    pagesAsPartials: false,
    header: '',
    footer: '',
    helpers: [],
    bundlePages: {}
  }
  this.precompileSteps = []; //These are run on pages before they go through handlebars
  this.steps = []; //These are run on pages AFTER they go through handlebars
  this.helpers = [] //These are handlebars helpers
}

Parser.prototype.log = function() {
  if(this.config.debug) {
    console.log.apply(this, arguments)
  }
}

Parser.prototype.getPageFiles = function () {
  var readDir = fs.readdirSync(this.config.pagesDir)
  var files = readDir.filter(function (file) {
      console.log('file', file);
    var filename = path.basename(file)
    if(fs.lstatSync(path.join(this.config.pagesDir, file)).isDirectory()) {
      return false
    }

    if(!this.config.pagesOnly || this.config.pagesOnly.indexOf(filename) >= 0) {
      return true
    }

    return false
  }.bind(this))

  console.log('files',files);

  if(this.config.pagesMatch) {
    files = files.filter(function (file) {
      var matches = file.match(new RegExp(this.config.pagesMatch))
      return matches
    }.bind(this))
  }

  return files
}

Parser.prototype.registerHelper = function (fn) {
  this.helpers.push(fn)
}

Parser.prototype.registerHelpers = function () {
  if(this.config.helperFiles) {
    this.config.helperFiles.forEach(function (file) {
      this.registerHelperFile(file)
    }.bind(this))
  }
  if(this.helpers) {
    this.helpers.forEach(function (helper) {
      helper(handlebars, this.gameData)
    }.bind(this))
  }
}

Parser.prototype.registerHelperFile = function (file) {
  require(file)(handlebars, this.gameData)
}

Parser.prototype.registerStartingStep = function (fn, config) {
  this.steps.unshift({
    fn: fn,
    config: config
  });
}

Parser.prototype.registerStep = function (fn, config) {
  this.steps.push({
    fn: fn,
    config: config
  })
}

Parser.prototype.registerPrecompileStartingStep = function (fn, config) {
  this.precompileSteps.unshift({
    fn: fn,
    config: config
  });
}

Parser.prototype.registerPrecompileStep = function (fn, config) {
  this.precompileSteps.push({
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
  if(!this.config.partialsDirs) {
    return false
  }
  var files = []
  this.config.partialsDirs.forEach(function (dir) {
    var dirFiles = fs.readdirSync(dir)
    dirFiles = dirFiles.map(function (filename) {
      return path.join(dir, filename)
    })
    files = files.concat(dirFiles)
  })
  return files
}

Parser.prototype.registerPartials = function () {
  var mapFullPath = function (file, dir) {
    return path.join(dir, file)
  }

  //Get the basic partials
  var partialFiles = this.getPartialFiles()
  var filePaths = partialFiles || [];

  //Let's add the pages as partials, maybe
  if(this.config.pagesAsPartials) {
    var pageFiles = this.getPageFiles()
    if(pageFiles.length > 0) {
      var pagePaths = pageFiles.map(function (file) {
        return mapFullPath(file, this.config.pagesDir)
      }.bind(this))
      filePaths = filePaths.concat(pagePaths)
    }
  }
  if(!filePaths) {
    return false
  }
  filePaths.forEach(function (filePath) {
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
}

Parser.prototype.processArgv = function () {
  if(args.files) {
    this.config.pagesOnly = args.files.split(",")
  }
  if(args.match) {
    this.config.pagesMatch = args.match
  }
  if(args.debug) {
    this.config.debug = parseInt(args.debug) == 1
  }
}

Parser.prototype.run = function (done) {
  this.processArgv()
  this.registerHelpers()
  this.registerPartials()
  var pages = this.getPageFiles();

  //Load all page content from the files
  pages.forEach(function (page) {
    var pathStr = path.join(this.config.pagesDir, page);
    this.pages[page] = fs.readFileSync(pathStr, 'utf8')
  }.bind(this));

  //This are the steps that happen before the pages are run through handlebars
  //This allows extensions to replace handlebars tags and helpers
  //with their own. Ex: str.split('{{moves.').join('{{skills.')
  if(this.precompileSteps) {
    pages.forEach(function (name) {
      var content = this.pages[name];
      //Go through all of the precompile steps that have been registered
      async.eachSeries(this.precompileSteps, function (step, next) {
        step.fn(content, name, step.config, function (newcontent) {
          content = newcontent;
          next();
        }.bind(this));
      }.bind(this), function (err) {
        //Update the content of the page
        this.pages[name] = content;
      }.bind(this));
    }.bind(this));
  }

  //Compile the pages
  pages.forEach(function (page) {
    var template = handlebars.compile(this.pages[page]);
    var template2 = handlebars.compile(template(this.gameData))
    this.pages[page] = template2(this.gameData)
  }.bind(this));


  //Add the bundled pages to the main pages, concatenating the content
  for(var key in this.config.bundlePages) {
    var combined = ''
    var filename = key + '.' + this.config.outputExtension
    this.config.bundlePages[key].forEach(function (page) {
      combined += this.pages[page]
    }.bind(this))
    this.pages[key] = combined
  }

  async.each(pages, function (name, next) {
    var basename = path.basename(name, path.extname(name))
    var filename =  basename + '.' + this.config.outputExtension
    var content = this.pages[name];

    //Go through all of the steps that have been registered
    async.eachSeries(this.steps, function (step, next2) {
      step.fn(content, name, step.config, function (newcontent) {
        content = newcontent;
        next2();
      }.bind(this));
    }.bind(this), function (err) {
      //When all of the steps are done we save the page
      fs.writeFileSync(path.join(this.config.outputDir, filename), this.config.header + content + this.config.footer)
      next()
    }.bind(this));
  }.bind(this), function () {
    if(typeof(done) == 'function') {
      done();
    }
  });

}

module.exports = Parser