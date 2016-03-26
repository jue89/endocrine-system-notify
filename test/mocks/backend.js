"use strict";

const events = require( 'events' );

class BackendMock extends events.EventEmitter {

	constructor( options ) {

		super();

		this.sentErr = [];
		this.sentAck = [];
		this.sentRec = [];

	}

	error( recipient, name, hormone ) {
		this.sentErr.push( { recipient, name, hormone } );
		this.emit( 'sentErr', recipient, name, hormone );
	}

	acknowledge( recipient, name, user ) {
		this.sentAck.push( { recipient, name, user } );
		this.emit( 'sentAck', recipient, name, user );
	}

	recover( recipient, name ) {
		this.sentRec.push( { recipient, name } );
		this.emit( 'sentRec', recipient, name );
	}

}

module.exports = BackendMock;
