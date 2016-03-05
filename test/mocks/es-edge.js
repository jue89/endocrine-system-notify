"use strict";

const events = require( 'events' );

class Sink extends events.EventEmitter {

	constructor() {
		super();
	}

}

module.exports = { Classes: {
	Sink
} };
