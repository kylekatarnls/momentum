var momentum = new Momentum();
var people = [];
var setPeople = function (newPeople) {
    people = newPeople.sort();
    document.getElementById('people').innerHTML = JSON.stringify(people);
};
momentum.onReady(function () {
    document.getElementById('status').innerHTML = 'ready';
    momentum.listenCollection('people');
    momentum.find(['people'], function (data) {
        setPeople(data.result.map(function (person) {
            return person.name;
        }));
    });
});
var stop = function () {};
var start = function () {
    stop();
    stop = momentum.on(function (data) {
        var events = data.events;
        document.getElementById('log').innerHTML += events.map(function (event) {
            var id = event.args.pop();
            people.push(event.args[4].name);

            return '<span title="' + id + '">' + event.args[4].name + ' added</span>\n';
        }).join('');
        setPeople(people);
    });
};
var add = function () {
    var name = document.getElementById('name').value;
    momentum.insertOne(['people', {name: name}]);
};
start();
