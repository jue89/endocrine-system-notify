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
		// - backend
		if( typeof options.backend != 'object' ) {
			throw new Error( "'backend' must be a backend instance" );
		}


		// Store options
		this._escalationLevels = options.escalationLevels;
		this._backend = options.backend;

		// Setup stores
		this._escalations = {};


		// Setup required event listeners
		if( options.escalateHormoneExpiration ) {

			// Escalate on expiration
			options.receptor.on(
				'hormoneExpiration',
				( name, hormone ) => this._escalate( name, hormone )
			);

			// Deescalate when hormone has been refreshed
			options.receptor.on(
				'hormoneRefresh',
				( name, hormone ) => this._deescalate( name )
			);

		}

		if( options.escalateHormoneError ) {

			// Escalate on error
			options.receptor.on(
				'hormoneError',
				( name, hormone ) => this._escalate( name, hormone )
			);

			// Deescalate when hormone has been recovered
			options.receptor.on(
				'hormoneRecovery',
				( name, hormone ) => this._deescalate( name )
			);

		}

		// Also deescalate undefined hormones
		options.receptor.on(
			'undefined',
			( name ) => this._deescalate( name )
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

				// Start a new escalation
				this._escalations[ name ] = new Escalation( this._backend, name, hormone, levels );

				// Send event
				this.emit( 'escalate', name, hormone );

			} );

		}

	}

	_deescalate( name ) {

		// If no escalation is known regarding the given hormone -> skip
		if( ! this._escalations[ name ] ) return;


		// Deescalate and delete when hormone has been refreshed
		this._escalations[ name ].deescalate();
		delete this._escalations[ name ];

		// Send event
		this.emit( 'deescalate', name );

	}

}

module.exports = Notify;
