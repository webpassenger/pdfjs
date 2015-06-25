console.log('Loading a web page');
var page = require('webpage').create();

page.onConsoleMessage = function(msg) {
    console.log('CONSOLE: ' + msg);
    if (msg == 'phantom get out!!!') phantom.exit();
};

var url = 'http://localhost:8082/helloworld.html';
page.open(url, function (status) {
    //Page is loaded!
    console.log('Page is loaded!');
});