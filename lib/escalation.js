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

	constructor( backends, name, hormone, levels ) {

		super();

		// Check parameters:
		// - backends has been cheked by Notify ... hopefully
		// - name
		if( typeof name != 'string' ) {
			throw new Error( "'name' must be a string" );
		}
		// - levels might be bullshit ...
		if( levels instanceof Array ) {
			levels.forEach( ( level ) => {
				if( ! ( level.recipients instanceof Array ) ) {
					throw new Error( "'levels[].recipients' must be an array" );
				}
				if( level.delay && typeof level.delay != 'number' ) {
					throw new Error( "'levels[].delay' must be a number" );
				}
			} );
		} else {
			throw new Error( "'levels' must be an array" );
		}

		// Store parameters
		this._backends = backends;
		this._name = name;
		this._hormone = hormone;
		this._levels = levels;

		// Setup stores
		this._acknowledged = false;
		this._recipients = [];

		// Set event handlers for all backends
		for( let name in backends ) {
			backends[ name ].on( 'ack_' + name, ( user ) => this._acknowledge( user ) );
		}

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

				// Check if required information is present:
				// - backend
				if( typeof recipient.backend != 'string' ) {
					this.emit( 'error', new Error( "Cannot deliver error message to " + JSON.stringify( recipient ) + ": 'backend' option is missing" ) );
					return;
				} else if( ! this._backends[ recipient.backend ] ) {
					this.emit( 'error', new Error( "Cannot deliver error message to " + JSON.stringify( recipient ) + ": Unkown backend" ) );
					return;
				}
				// - name
				if( typeof recipient.name != 'string' )  {
					this.emit( 'error', new Error( "Cannot deliver error message to " + JSON.stringify( recipient ) + ": 'name' is missing" ) );
					return;
				}

				try {

					// Send error message
					this._backends[ recipient.backend ].error( recipient, this._name, this._hormone );

					// Store that the user has been notified
					this._recipients.push( recipient );

				} catch( e ) {

					this.emit( 'error', e );

				}

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

			try {
				// Send ack message to other users
				// The error method already checked options of recipients.
				// There is no need to these checks again.
				this._backends[ recipient.backend ].acknowledge( recipient, this._name, user );
			} catch( e ) {
				this.emit( 'error', e );
			}

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
			try {
				// The error method already checked options of recipients.
				// There is no need to these checks again.
				this._backends[ recipient.backend ].recover( recipient, this._name );
			} catch( e ) {
				this.emit( 'error', e );
			}
		} );

		// Remove backend listener
		for( let name in this._backends ) {
			this._backends[ name ].removeAllListeners( 'ack_' + this._name );
		}

		this.emit( 'deescalate', this._name );

	}

}

module.exports = Escalation;
