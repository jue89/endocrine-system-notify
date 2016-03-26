"use strict";

const events = require( 'events' );

class Escalation extends events.EventEmitter {

	constructor( backend, name, hormone, levels ) {
		super();

		if( name == 'escalation-fail' ) throw new Error( "ES FAIL" );

		if( name == 'escalation-fail2' ) setImmediate( () => {
			this.emit( 'error', new Error( "ES FAIL2" ) );
		} )

	}

	update() {}

	deescalate() {}

}

module.exports = Escalation;
