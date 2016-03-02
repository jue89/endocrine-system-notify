"use strict";

const events = require( 'events' );


// Helper function for equality checking of objects
function deepEqual( a, b ) {
	if( typeof a != 'object' || typeof b != 'object' ) return a === b;

	// Get all keys of a
	let keys = Object.keys( a );

	// Go through b and search for the keys in a
	let foundKeys = 0;
	for( let key in b ) {
		if( keys.indexOf( key ) == -1 ) return false;
		foundKeys++;
	}

	// Check if the number of found keys is identical to the number of
	// keys in a
	if( foundKeys != keys.length ) return false;

	// We got here if all keys are matching. Now check their content
	for( let k of keys ) {
		// Check values
		if( ! deepEqual( a[k], b[k] ) ) return false;
	}

	// Nothing has stopped us from getting here ...
	return true;
}


class Escalation extends events.EventEmitter {

	constructor( backend, name, hormone, levels ) {

		super();

		// TODO: Check parameters

		// Store parameters
		this._backend = backend;
		this._name = name;
		this._hormone = hormone;
		this._levels = levels;

		// Setup stores
		this._acknowledged = false;
		this._recipients = [];

		// Set event handlers
		backend.on( 'ack_' + name, ( user ) => this._acknowledge( user ) );

		// Finally: Escalate!
		this._escalate( 0 );

	}

	_escalate( level ) {

		// If we are at the end of escalation levels, stop here ...
		if( level >= this._levels.length ) return;

		let curLevel = this._levels[ level ];

		// Wait for given delay
		this._escalationTimeout = setTimeout( () => {

			// It's time to escalate!!!
			this.emit( 'escalate', this._name, level, curLevel.recipients );

			// Go through all recipients and send error message
			curLevel.recipients.forEach( ( recipient ) => {

				// Send error message
				this._backend.error( recipient, this._name, this._hormone );

				// Store that the user has been notified
				this._recipients.push( recipient );

			} );

			// Excalate the next level
			this._escalate( level + 1 );

		}, curLevel.delay ? curLevel.delay * 1000 : 0 );

	}

	_acknowledge( user ) {

		// Stop escalation by killing escalation timeout
		clearTimeout( this._escalationTimeout );

		// Mark this as acknowledged
		this._acknowledged = true;

		// Go through all recipients and send acknowledge message
		this._recipients.forEach( ( recipient ) => {
			// Skip the user who acknowledged
			if( deepEqual( user, recipient ) ) return;
			// Send ack message to other users
			this._backend.acknowledge( recipient, this._name, user );
		} );

		this.emit( 'acknowledged', this._name, user );

	}

	update( hormone ) {
		this._hormone = hormone;
	}

	deescalate() {

		// Stop escalation by killing escalation timeout
		clearTimeout( this._escalationTimeout );

		// Tell the good news to all recipients of the bad news
		this._recipients.forEach( ( recipient ) => {
			this._backend.recover( recipient, this._name );
		} );

		// Remove backend listener
		this._backend.removeAllListeners( 'ack_' + this._name );

		this.emit( 'deescalate', this._name );

	}

}

module.exports = Escalation;
