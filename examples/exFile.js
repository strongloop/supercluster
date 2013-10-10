console.log('This is standard out.');
console.error('This is standard err');
process.argv.forEach(function (val, index, array) {
    console.log(index + ': ' + val);
});
