"use strict";

const events = require( 'events' );

const ESedge = require( 'es-edge' );

const Escalation = require( './escalation.js' );

class Notify extends events.EventEmitter {

	constructor( options ) {
		super();

		if( options === undefined ) options = {};

		// Validate options
		// - receptor
		if( ! ( options.receptor instanceof ESedge.Classes.Sink ) ) {
			throw new Error( "'receptor' must be a receptor instance" );
		}
		// - escalationLevels
		if( options.escalationLevels instanceof Array ) {
			options.escalationLevels.forEach( ( level ) => {
				if( ! ( level.recipients instanceof Array ) ) {
					throw new Error( "'escalationLevels[].recipients' must be an array" );
				}
				if( level.delay && typeof level.delay != 'number' ) {
					throw new Error( "'escalationLevels[].delay' must be a number" );
				}
			} );
		} else if(  typeof options.escalationLevels != 'function' ) {
			throw new Error( "'escalationLevels' must be an array or function" );
		}
		// - escalateHormoneExpiration
		if( options.escalateHormoneExpiration === undefined ) {
			options.escalateHormoneExpiration = true;
		} else if( typeof options.escalateHormoneExpiration != 'boolean' ) {
			throw new Error( "'escalateHormoneExpiration' must be a boolean" );
		}
		// - escalateHormoneError
		if( options.escalateHormoneError === undefined ) {
			options.escalateHormoneError = true;
		} else if( typeof options.escalateHormoneError != 'boolean' ) {
			throw new Error( "'escalateHormoneError' must be a boolean" );
		}
		// - backends
		if( typeof options.backends != 'object' ) {
			throw new Error( "'backends' must be an object of backend instances" );
		} else {
			for( let name in options.backends ) {
				let b = options.backends[ name ];
				if(
					typeof b != 'object' ||
					typeof b.error != 'function' ||
					typeof b.acknowledge != 'function' ||
					typeof b.recover != 'function' ||
					! ( b instanceof events.EventEmitter )
				) {
					throw new Error( "'backends[]' must be an instance of backend" );
				}
			}
		}


		// Store options
		this._receptor = options.receptor;
		this._escalationLevels = options.escalationLevels;
		this._backends = options.backends;
		this._escalateHormoneExpiration = options.escalateHormoneExpiration;
		this._escalateHormoneError = options.escalateHormoneError;

		// Setup stores
		this._escalations = {};


		// Setup required event listeners
		this._listeners = {};
		if( options.escalateHormoneExpiration ) {

			// Escalate on expiration
			this._listeners.hormoneExpiration = ( name, hormone ) => this._escalate( name, hormone );
			options.receptor.on(
				'hormoneExpiration',
				this._listeners.hormoneExpiration
			);

			// Deescalate when hormone has been refreshed
			this._listeners.hormoneRefresh = ( name, hormone ) => this._escalate( name, hormone );
			options.receptor.on(
				'hormoneRefresh',
				( name, hormone ) => this._deescalate( name, hormone )
			);

		}

		if( options.escalateHormoneError ) {

			// Escalate on error
			this._listeners.hormoneError = ( name, hormone ) => this._escalate( name, hormone );
			options.receptor.on(
				'hormoneError',
				this._listeners.hormoneError
			);

			// Deescalate when hormone has been recovered
			this._listeners.hormoneRecovery = ( name, hormone ) => this._deescalate( name, hormone );
			options.receptor.on(
				'hormoneRecovery',
				this._listeners.hormoneRecovery
			);

		}

		// Also deescalate undefined hormones
		this._listeners.undefined = ( name ) => this._deescalate( name );
		options.receptor.on(
			'undefined',
			this._listeners.undefined
		);

		this.emit( 'ready' );

	}

	_escalate( name, hormone ) {

		if( this._escalations[ name ] ) {

			// If this hormone has been escalated update hormone data
			this._escalations[ name ].update( hormone );

			// Send event
			this.emit( 'updateEscalation', name, hormone );

		} else {

			// Get the escalation levels. It might be an array or a callback function
			let eLevelsDeferred;
			if( typeof this._escalationLevels == 'function' ) {
				// The callback function will return the escalation levels eventually
				let ret = this._escalationLevels( name );
				// If no promise has been returned convert it into one ...
				eLevelsDeferred = ( ret instanceof Promise ) ? ret : Promise.resolve( ret );
			} else {
				// It's an array -> resolve the array
				eLevelsDeferred = Promise.resolve( this._escalationLevels );
			}

			eLevelsDeferred.then( ( levels ) => {

				// Something might will went wrong ... safety first ;)
				try {

					// Start a new escalation
					let escalation = new Escalation( this._backends, name, hormone, levels );

					// Bypass error events
					escalation.on( 'error', ( e ) => this.emit( 'error', e ) );

					this._escalations[ name ] = escalation;

					// Send event
					this.emit( 'escalate', name, hormone );

				} catch( e ) {

					// Something went wrong -> Emit error event
					this.emit( 'error', e );

				}

			} );

		}

	}

	_deescalate( name, hormone ) {

		// If no escalation is known regarding the given hormone -> skip
		if( ! this._escalations[ name ] ) return;

		// Maybe it's not time to deescalate -> update
		if(
			hormone !== undefined && (
				this._escalateHormoneError && hormone.error > 0 ||
				this._escalateHormoneExpiration && ! hormone.isFresh
			)
		) {

			this._escalations[ name ].update( hormone );

			// Send event
			this.emit( 'updateEscalation', name, hormone );

		} else {

			// Deescalate and delete when hormone has been refreshed
			this._escalations[ name ].deescalate();

			// Remove error listener
			this._escalations[ name ].removeAllListeners( 'error' );
			delete this._escalations[ name ];

			// Send event
			this.emit( 'deescalate', name );

		}

	}

	shutdown( deescalate ) {

		// Remove event listeners
		for( let l in this._listeners ) {
			this._receptor.removeListener( l, this._listeners[ l ] );
		}

		// Deescalate
		if( deescalate === true ) {
			for( let e in this._escalations ) {
				this._deescalate( e );
			}
		}

	}

}

module.exports = Notify;
