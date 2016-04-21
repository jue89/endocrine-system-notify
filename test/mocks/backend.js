"use strict";

const events = require( 'events' );

class BackendMock extends events.EventEmitter {

	constructor( options ) {

		super();

		this.sentErr = [];
		this.sentAck = [];
		this.sentRec = [];

	}

	error( recipient, hormone ) {
		this.sentErr.push( { recipient, name: hormone.name, hormone } );
		this.emit( 'sentErr', recipient, hormone.name, hormone );
	}

	acknowledge( recipient, hormone, user ) {
		this.sentAck.push( { recipient, name: hormone.name, user } );
		this.emit( 'sentAck', recipient, hormone.name, user );
	}

	recover( recipient, hormone ) {
		this.sentRec.push( { recipient, name: hormone.name } );
		this.emit( 'sentRec', recipient, hormone.name );
	}

}

module.exports = BackendMock;
