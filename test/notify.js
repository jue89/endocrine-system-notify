"use strict";

const assert = require( 'assert' );
const mockery = require( 'mockery' );


describe( "Class Notify", function() {

	let ESedge;
	let Escalation;
	let Notify;
	let Hormone;
	let Backend;

	before( ( done ) => {

		mockery.enable( {
			useCleanCache: true,
			warnOnReplace: false,
			warnOnUnregistered: false
		} );

		// Install all mocks
		ESedge = require( './mocks/es-edge.js' );
		mockery.registerMock( 'es-edge', ESedge );
		Escalation = require( './mocks/escalation.js' );
		mockery.registerMock( './escalation.js', Escalation );
		Hormone = require( './mocks/hormone.js' );
		Backend = require( './mocks/backend.js' );

		// Require all librarys required for tests
		Notify = require( '../lib/notify.js' );

		done();

	} );

	after( ( done ) => {

		mockery.disable();

		done();

	} );

	it( "should reject due to missing receptor", ( done ) => {
		try {
			new Notify();
		} catch( e ) { /*console.log( e );*/ done(); }
	} );

	it( "should reject due to non-receptor receptor option", ( done ) => {
		try {
			new Notify( {
				receptor: true
			} );
		} catch( e ) { /*console.log( e );*/ done(); }
	} );

	it( "should reject due to missing escalationLevels", ( done ) => {
		try {
			new Notify( {
				receptor: new ESedge.Classes.Sink()
			} );
		} catch( e ) { /*console.log( e );*/ done(); }
	} );

	it( "should reject due to wrong escalationLevels content: recipients", ( done ) => {
		try {
			new Notify( {
				receptor: new ESedge.Classes.Sink(),
				escalationLevels: [ { delay: 1, recipients: true } ]
			} );
		} catch( e ) { /*console.log( e );*/ done(); }
	} );

	it( "should reject due to wrong escalationLevels content: delay", ( done ) => {
		try {
			new Notify( {
				receptor: new ESedge.Classes.Sink(),
				escalationLevels: [ { delay: true, recipients: [] } ]
			} );
		} catch( e ) { /*console.log( e );*/ done(); }
	} );

	it( "should reject due to wrong escalateHormoneExpiration", ( done ) => {
		try {
			new Notify( {
				receptor: new ESedge.Classes.Sink(),
				escalationLevels: [ { delay: 0, recipients: [] } ],
				escalateHormoneExpiration: 123
			} );
		} catch( e ) { /*console.log( e );*/ done(); }
	} );

	it( "should reject due to wrong escalateHormoneError", ( done ) => {
		try {
			new Notify( {
				receptor: new ESedge.Classes.Sink(),
				escalationLevels: [ { delay: 0, recipients: [] } ],
				escalateHormoneExpiration: true,
				escalateHormoneError: 123
			} );
		} catch( e ) { /*console.log( e );*/ done(); }
	} );

	it( "should reject due to wrong backend", ( done ) => {
		try {
			new Notify( {
				receptor: new ESedge.Classes.Sink(),
				escalationLevels: [ { delay: 0, recipients: [] } ],
				escalateHormoneExpiration: true,
				escalateHormoneError: true,
				backend: { 'backend': {} }
			} );
		} catch( e ) { /*console.log( e );*/ done(); }
	} );

	it( "should escalate on hormone error if set in options", ( done ) => {
		let h = new Hormone( true, 1 );
		let r = new ESedge.Classes.Sink();
		let n = new Notify( {
			receptor: r,
			escalationLevels: [ { delay: 0, recipients: [] } ],
			escalateHormoneExpiration: false,
			escalateHormoneError: true,
			backends: { 'backend' : new Backend() }
		} );

		n.on( 'escalate', ( id, name, hormone ) => {
			try {
				assert.strictEqual( name, 'test' );
				assert.deepStrictEqual( hormone, h );
				done();
			} catch( e ) { done(e); }
		} );

		r.emit( 'hormoneError', 'test', h );
	} );

	it( "should not escalate on hormone error if not set in options", ( done ) => {
		let h = new Hormone( true, 1 );
		let r = new ESedge.Classes.Sink();
		let n = new Notify( {
			receptor: r,
			escalationLevels: [ { delay: 0, recipients: [] } ],
			escalateHormoneExpiration: false,
			escalateHormoneError: false,
			backends: { 'backend' : new Backend() }
		} );

		n.on( 'escalate', ( id, name, hormone ) => {
			done( new Error( "This should not happen!" ) );
			done = function() {};
		} );

		r.emit( 'hormoneError', 'test', h );

		setTimeout( () => done(), 20 );
	} );


	it( "should escalate on hormone expiration if set in options", ( done ) => {
		let h = new Hormone( false, 0 );
		let r = new ESedge.Classes.Sink();
		let n = new Notify( {
			receptor: r,
			escalationLevels: [ { delay: 0, recipients: [] } ],
			escalateHormoneExpiration: true,
			escalateHormoneError: false,
			backends: { 'backend' : new Backend() }
		} );

		n.on( 'escalate', ( id, name, hormone ) => {
			try {
				assert.strictEqual( name, 'test' );
				assert.deepStrictEqual( hormone, h );
				done();
			} catch( e ) { done(e); }
		} );

		r.emit( 'hormoneExpiration', 'test', h);
	} );

	it( "should not escalate on hormone expiration if not set in options", ( done ) => {
		let h = new Hormone( false, 0 );
		let r = new ESedge.Classes.Sink();
		let n = new Notify( {
			receptor: r,
			escalationLevels: [ { delay: 0, recipients: [] } ],
			escalateHormoneExpiration: false,
			escalateHormoneError: false,
			backends: { 'backend' : new Backend() }
		} );

		n.on( 'escalate', ( id, name, hormone ) => {
			done( new Error( "This should not happen!" ) );
			done = function() {};
		} );

		r.emit( 'hormoneExpiration', 'test', h );

		setTimeout( () => done(), 20 );
	} );

	it( "should escalate on hormone expiration and not deescalate on refresh if hormone is erroneous and hormone errors should be observed as well", ( done ) => {
		let h1 = new Hormone( false, 0 );
		let h2 = new Hormone( true, 1 );
		let h3 = new Hormone( true, 0 );
		let r = new ESedge.Classes.Sink();
		let n = new Notify( {
			receptor: r,
			escalationLevels: [ { delay: 0, recipients: [] } ],
			escalateHormoneExpiration: true,
			escalateHormoneError: true,
			backends: { 'backend' : new Backend() }
		} );

		n.on( 'deescalated', ( name ) => {
			done( new Error( "This should not happen." ) );
		} );

		setTimeout( () => {
			r.emit( 'hormoneExpiration', 'test', h1 );
		}, 20 );

		setTimeout( () => {
			r.emit( 'hormoneRefresh', 'test', h2 );
			r.emit( 'hormoneError', 'test', h2 );
		}, 40 );

		setTimeout( () => {
			n.removeAllListeners( 'deescalated' );
			n.on( 'deescalated', ( name ) => {
				done();
			} );
			r.emit( 'hormoneRecovery', 'test', h3 );
		}, 60 );

	} );

	it( "should escalate on hormone expiration and not deescalate on refresh even if hormone is erroneous and hormone errors should not be observed", ( done ) => {
		let h1 = new Hormone( false, 0 );
		let h2 = new Hormone( true, 1 );
		let r = new ESedge.Classes.Sink();
		let n = new Notify( {
			receptor: r,
			escalationLevels: [ { delay: 0, recipients: [] } ],
			escalateHormoneExpiration: true,
			escalateHormoneError: false,
			backends: { 'backend' : new Backend() }
		} );

		n.on( 'deescalated', ( name ) => {
			done();
		} );

		setTimeout( () => {
			r.emit( 'hormoneExpiration', 'test', h1 );
		}, 20 );

		setTimeout( () => {
			r.emit( 'hormoneRefresh', 'test', h2 );
			r.emit( 'hormoneError', 'test', h2 );
		}, 40 );

	} );

	it( "should deescalate upon undefined hormone", ( done ) => {
		let h = new Hormone( false, 0 );
		let r = new ESedge.Classes.Sink();
		let n = new Notify( {
			receptor: r,
			escalationLevels: [ { delay: 0, recipients: [] } ],
			escalateHormoneExpiration: true,
			escalateHormoneError: false,
			backends: { 'backend' : new Backend() }
		} );

		n.on( 'escalate', ( id, name ) => {
			setImmediate( () => r.emit( 'undefined', name ) );
		} );

		n.on( 'deescalated', () => {
			done();
		} );

		r.emit( 'hormoneExpiration', 'test', h );

	} );

	it( "should emit an error if escalation was not successful", ( done ) => {
		let h = new Hormone( true, 1 );
		let r = new ESedge.Classes.Sink();
		let n = new Notify( {
			receptor: r,
			escalationLevels: [ { delay: 0, recipients: [] } ],
			escalateHormoneExpiration: false,
			escalateHormoneError: true,
			backends: { 'backend' : new Backend() }
		} );

		n.on( 'error', ( e ) => {
			try {
				assert.strictEqual( e.message, 'ES FAIL' );
				done();
			} catch( e ) {
				done( e );
			}
		} );

		r.emit( 'hormoneError', 'escalation-fail', h );
	} );

	it( "should forward errors from escalation instance", ( done ) => {
		let h = new Hormone( true, 1 );
		let r = new ESedge.Classes.Sink();
		let n = new Notify( {
			receptor: r,
			escalationLevels: [ { delay: 0, recipients: [] } ],
			escalateHormoneExpiration: false,
			escalateHormoneError: true,
			backends: { 'backend' : new Backend() }
		} );

		n.on( 'error', ( e ) => {
			try {
				assert.strictEqual( e.message, 'ES FAIL2' );
				done();
			} catch( e ) {
				done( e );
			}
		} );

		r.emit( 'hormoneError', 'escalation-fail2', h );
	} );

} );
