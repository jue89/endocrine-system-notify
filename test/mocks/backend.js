"use strict";

const events = require( 'events' );

class BackendMock extends events.EventEmitter {

	constructor( options ) {

		super();

	}

	error( recipient, name, hormone ) { }

	acknowledge( recipient, name, user ) { }

	recover( recipient, name ) { }

}

module.exports = BackendMock;
