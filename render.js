#!/usr/bin/env node

var Phantom = require('phantom');

const HTML_FILE = 'file:///' + __dirname + '/input.html';
const OUTPUT_FILE = 'output.png';

var page, phantom;

Phantom.create().then(instance =>
{
    phantom = instance;
    return instance.createPage();
})
.then(result =>
{
    page = result;
    return page.open(HTML_FILE);
})
.then(status =>
{
    page.property('viewportSize', { width: 285, height: 150 });
    page.render(OUTPUT_FILE);
}).then(function()
{
	page.close();
	phantom.exit();
})
.catch(error => {
    console.log(error);
    phantom.exit(1);
});
