var momentum = new Momentum();
momentum.onReady(function () {
    document.getElementById('status').innerHTML = 'ready';
    momentum.listenCollection('people');
    momentum.find(['people'], function (data) {
        console.log(data);
    });
});
var stop = function () {};
var start = function () {
    stop();
    stop = momentum.on(function (data) {
        var events = data.events;
        document.getElementById('log').innerHTML += events.length + 'new events:\n' +
            events.map(function (event) {
                var id = event.args.pop();

                return id + ': ' + event.args[4].name + '\n';
            }).join('') + '\n';
    });
};
var add = function () {
    var name = document.getElementById('name').value;
    momentum.insertOne(['people', {name: name}], function (data) {
        document.getElementById('add-callback').innerHTML += JSON.stringify(data) + '\n';
    });
};
start();
