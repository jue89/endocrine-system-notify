"use strict";

const events = require( 'events' );

class Escalation extends events.EventEmitter {

	constructor( backend, name, hormone, levels ) {
		super();
	}

	update() {}

	deescalate() {}

}

module.exports = Escalation;
