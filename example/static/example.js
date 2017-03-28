var momentum = new Momentum();
momentum.onReady(function () {
    document.getElementById('status').innerHTML = 'ready';
    momentum.listenCollection('people');
});
var stop = function () {};
var start = function () {
    stop();
    stop = momentum.on(function () {
        document.getElementById('log').innerHTML += [].map.call(arguments, function (data) {
            return data.events.length + 'new events:\n' +
                data.events.map(function (event) {
                    var id = event.args.pop();

                    return id + ': ' + event.args[4].name + '\n';
                }).join('') + '\n';
        }).join('');
    });
};
var add = function () {
    var name = document.getElementById('name').value;
    momentum.insertOne(['people', {name: name}], function (data) {
        document.getElementById('add-callback').innerHTML += JSON.stringify(data) + '\n';
    });
};
start();
