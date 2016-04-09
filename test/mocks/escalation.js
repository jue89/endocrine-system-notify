"use strict";

const events = require( 'events' );

class Escalation extends events.EventEmitter {

	constructor( backend, name, hormone, levels, eEmitter ) {
		super();

		if( name == 'escalation-fail' ) throw new Error( "ES FAIL" );

		if( name == 'escalation-fail2' ) setImmediate( () => {
			this._e.emit( 'error', new Error( "ES FAIL2" ) );
		} )

		this._e = ( eEmitter instanceof events.EventEmitter ) ? eEmitter : this;

		this._e.emit( 'escalate', 'id', name, hormone );

	}

	update() {
		this._e.emit( 'updateEscalation' );
	}

	deescalate() {
		this._e.emit( 'deescalated' );
	}

}

module.exports = Escalation;
