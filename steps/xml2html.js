var jsdom                     = require("jsdom");
var slugify                   = require('slug')
module.exports = function (content, name, config, done) {
  config = config || {}
  config.protectedNodeNames = config.protectedNodeNames || {}
  config.protectedNodeNames.push('body')
  config.protectedNodeNames.push('script')

  jsdom.env(content,
    ["http://code.jquery.com/jquery.min.js"],
    function (err, window) {
      var $ = window.$

      function replaceChildren (elem) {
        var children = $(elem).children()
        if(children.length > 0) {
          children.each(function (index, child) {
            replaceChildren(child)
          })
        }
        $(elem).replaceWith(getElementReplacement(elem))
      }

      //This assumes all children are already replaced
      function getElementReplacement (elem) {
        var nodeName = $(elem).prop('nodeName').toLowerCase()
        //This ensures that things like <ul></ul> don't become <div class="ul"></div>
        if(config.protectedNodeNames.indexOf(nodeName) >= 0) {
          return $(elem)[0].outerHTML
        }
        var newNodeName = config.nodesToNodes.hasOwnProperty(nodeName) ? config.nodesToNodes[nodeName] : 'div'
        var newNode = window.document.createElement(newNodeName)

        $.each(elem.attributes, function() {
          if(this.value !== undefined) {
            $(newNode).attr(this.name, this.value)
          }
        });

        $(newNode).addClass(nodeName)
        $(newNode).html($(elem)[0].innerHTML)
        var replace = $(newNode)[0].outerHTML
        return replace
      }


      //console.log('$(body).html()', $('body').html())

      replaceChildren($('body'))

      if(config.idsFromText && config.idsFromText.length > 0) {
        config.idsFromText.forEach(function (selector) {
          $(selector).each(function (index, el) {
            $(el).attr('id', slugify($(el).text(), {lower: true}))
          })
        })
      }

      if(config.anchorsFromText && config.anchorsFromText.length > 0) {
        config.anchorsFromText.forEach(function (selector) {
          $(selector).each(function (index, el) {
            var a = window.document.createElement('a')
            $(a).addClass('anchor-from-text').attr('id', slugify($(el).text(), {lower: true}))
            $(el).prepend(a)
          })
        })
      }

      //Get rid of the jQuery files jsdom inserts
      //It adds 3 for some reason
      $('script').each(function (i, el) {
        if($(el).attr("src").indexOf('http://code.jquery.com/jquery.min.js') == 0) {
          $(el).remove()
        }
      })

      $('head').remove()
      var html = $('html')[0].innerHTML
      done(html)
    }
  )
};
