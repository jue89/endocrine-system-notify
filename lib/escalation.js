"use strict";

const events = require( 'events' );
const uuid = require( 'uuid' );


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

	constructor( backends, hormone, levels, eEmitter ) {

		super();

		// Check parameters:
		// - backends has been cheked by Notify ... hopefully
		// - name
		if( typeof hormone.name != 'string' ) {
			throw new Error( "'hormone.name' must be a string" );
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

		// Create a UUIDv4
		this._id = uuid.v4();

		// Store parameters
		this._backends = backends;
		this._name = hormone.name;
		this._hormone = hormone;
		this._levels = levels;
		this._e = ( eEmitter instanceof events.EventEmitter ) ? eEmitter : this;

		// Setup stores
		this._acknowledged = false;
		this._recipients = [];

		// Set event handlers for all backends
		for( let b in backends ) {
			backends[ b ].on( 'ack_' + hormone.name, ( user ) => this._acknowledge( user ) );
		}

		// Emit an event that we are about to escalate
		let env = { escalationID: this._id };
		Object.assign( env, this._hormone );
		this._e.emit( 'escalate', env );

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
			let env = { escalationID: this._id, level: level };
			Object.assign( env, this._hormone );
			this._e.emit( 'escalatedLevel', env );

			// Go through all recipients and send error message
			curLevel.recipients.forEach( ( recipient ) => {

				// Update env for the current recipient
				env.recipient = recipient;

				// Check if required information is present:
				// - backend
				if( typeof recipient.backend != 'string' ) {
					this._e.emit(
						'error',
						new Error( "Cannot deliver error message to " + JSON.stringify( recipient ) + ": 'backend' option is missing" ),
						env
					);
					return;
				} else if( ! this._backends[ recipient.backend ] ) {
					this._e.emit(
						'error',
						new Error( "Cannot deliver error message to " + JSON.stringify( recipient ) + ": Unkown backend" ),
						env
					);
					return;
				}
				// - name
				if( typeof recipient.name != 'string' )  {
					this._e.emit(
						'error',
						new Error( "Cannot deliver error message to " + JSON.stringify( recipient ) + ": 'name' is missing" ),
						env
					);
					return;
				}

				try {

					// Send error message
					this._backends[ recipient.backend ].error( recipient, this._hormone );

					// Store that the user has been notified
					this._recipients.push( recipient );

					this._e.emit( 'msgEscalation', env );

				} catch( e ) {

					this._e.emit( 'error', e );

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

		// Emit event
		let env = { escalationID: this._id, user: user };
		Object.assign( env, this._hormone );
		this._e.emit( 'acknowledged', env );

		// Go through all recipients and send acknowledge message
		this._recipients.forEach( ( recipient ) => {

			// Skip the user who acknowledged
			if( deepEqual( user, recipient ) ) return;

			// Update environment
			env.recipient = recipient;

			try {

				// Send ack message to other users
				// The error method already checked options of recipients.
				// There is no need to these checks again.
				this._backends[ recipient.backend ].acknowledge( recipient, this._hormone, user );

				this._e.emit( 'msgAcknowledged', env );

			} catch( e ) {

				this._e.emit( 'error', e, env );

			}

		} );

	}

	update( hormone ) {

		// Make sure that the name hasn't changed!
		if( hormone.name != this._name ) return;

		// Update the hormone
		this._hormone = hormone;

		// Emit event
		let env = { escalationID: this._id };
		Object.assign( env, this._hormone );
		this._e.emit( 'updateEscalation', env );

	}

	// TODO: also update hormone
	deescalate() {

		// Stop escalation by killing escalation timeout
		clearTimeout( this._escalationTimeout );

		// Emit event
		let env = { escalationID: this._id };
		Object.assign( env, this._hormone );
		this._e.emit( 'deescalated', this._id, this._name );

		// Tell the good news to all recipients of the bad news
		this._recipients.forEach( ( recipient ) => {
			try {

				env.recipient = recipient;

				// The error method already checked options of recipients.
				// There is no need to these checks again.
				this._backends[ recipient.backend ].recover( recipient, this._hormone );

				this._e.emit( 'msgDeescalate', env );

			} catch( e ) {

				this._e.emit( 'error', e );

			}
		} );

		// Remove backend listener
		for( let b in this._backends ) {
			this._backends[ b ].removeAllListeners( 'ack_' + this._name );
		}

	}

	get id() { return this._id; }

}

module.exports = Escalation;
