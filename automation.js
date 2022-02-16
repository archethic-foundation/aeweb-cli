const jsdom = require("jsdom");
const { JSDOM } = jsdom;

JSDOM.fromFile("index.html").then(dom => {

    var nodelist = dom.window.document.querySelectorAll('[src],[href]');
    for (var i = 0; i < nodelist.length; ++i) {
      var item = nodelist[i];  
        if(item.getAttribute('src') !== null){
             console.log(item.getAttribute('src'));
             
        }
        if(item.getAttribute('href') !== null){
             console.log(item.getAttribute('href'));
        }
    }
});