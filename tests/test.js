/*
 * 	BSD 3-Clause License
 *
 * Copyright (c) 2019, NTT Ltd.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 *
 *  Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 *  Neither the name of the copyright holder nor the names of its
 *   contributors may be used to endorse or promote products derived from
 *   this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

var chai = require("chai");
var chaiSubset = require('chai-subset');
var readLastLines = require('read-last-lines');
var moment = require('moment');
const resetCache = require('resnap')();
chai.use(chaiSubset);
var expect = chai.expect;

describe("Tests", function() {
    beforeEach(resetCache);

    describe("Configuration loader", function () {
        process.argv[2] = "tests/config.test.yml";
        var env = require("../env");

        it("config structure", function () {
            expect(env.config).to.have
                .keys([
                    "environment",
                    "connectors",
                    "monitors",
                    "reports",
                    "checkStaleNotificationsSeconds",
                    "notificationIntervalSeconds",
                    "clearNotificationQueueAfterSeconds",
                    "monitoredPrefixesFiles",
                    "logging"
                ]);
            expect(env.config.connectors[0]).to.have
                .property('class')
        });

        it("loading connectors", function () {
            expect(env.config.connectors[0]).to
                .containSubset({
                    "params": {"testType": "withdrawal"},
                    "name": "tes"
                });
            expect(env.config.connectors[0]).to.have
                .property('class')
        });


        it("loading monitors", function () {
            expect(env.config.monitors[0]).to
                .containSubset({
                    "channel": "hijack",
                    "name": "basic-hijack-detection",
                    "params": undefined
                });

            expect(env.config.monitors[1]).to
                .containSubset({
                    "channel": "newprefix",
                    "name": "prefix-detection",
                    "params": undefined
                });

            expect(env.config.monitors[2]).to
                .containSubset({
                    "channel": "visibility",
                    "name": "withdrawal-detection",
                    "params": {
                        "threshold": 4
                    }
                });

            expect(env.config.monitors[0]).to.have
                .property('class')
        });

        it("loading reports", function () {
            expect(env.config.reports[0]).to
                .containSubset({
                    "channels": [
                        "hijack",
                        "newprefix",
                        "visibility"
                    ],
                    "params": undefined
                });

            expect(env.config.reports[0]).to.have
                .property('class')
        });

    });


    describe("Input loader", function () {
        process.argv[2] = "tests/config.test.yml";
        var env = require("../env");


        it("loading prefixes", function () {
            expect(env.input).to
                .containSubset({
                    "prefixes": [
                        {
                            "asn": [50601],
                            "description": "Solid Trading / Crossivity",
                            "ignoreMorespecifics": false,
                            "prefix": "124.40.52.128/26",
                            "user": "default",
                        },
                        {
                            "asn": [4713],
                            "description": "OCN prefix",
                            "ignoreMorespecifics": false,
                            "prefix": "180.50.120.0/21",
                            "user": "default",
                        },
                        {
                            "asn": [4713],
                            "description": "OCN prefix",
                            "ignoreMorespecifics": true,
                            "prefix": "180.57.120.0/21",
                            "user": "default",
                        }
                    ]
                });

        });


    });


    describe("Logging", function () {
        process.argv[2] = "tests/config.test.yml";
        var env = require("../env");

        it("errors logging on the right file", function (done) {
            const message = "Test message";
            env.logger
                .log({
                    level: "error",
                    message: message
                });

            const file = env.config.logging.directory + "/error-" + moment().format('YYYY-MM-DD') + ".log";
            readLastLines
                .read(file, 1)
                .then((line) => {
                    const lineMessage = line.split(" ").slice(3, 5).join(" ").trim();

                    expect(lineMessage).to
                        .equal(message);
                    done();
                });

        });

        it("reports logging on the right file", function (done) {
            const message = "Test message";
            env.logger
                .log({
                    level: "verbose",
                    message: message
                });

            const file = env.config.logging.directory + "/reports-" + moment().format('YYYY-MM-DD') + ".log";
            readLastLines
                .read(file, 1)
                .then((line) => {
                    const lineMessage = line.split(" ").slice(3, 5).join(" ").trim();

                    expect(lineMessage).to
                        .equal(message);
                    done();
                });

        });

    });

    describe("Alerting", function () {
        process.argv[2] = "tests/config.test.yml";
        var pubSub = require("../index");
        var env = require("../env");

        it("visibility reporting", function(done) {

            pubSub.subscribe("visibility", function (type, message) {

                expect(message).to
                    .containSubset({
                        id: '124.40.52.128/26',
                        origin: 'withdrawal-detection',
                        affected: 50601,
                        message: 'The prefix 124.40.52.128/26 (Solid Trading / Crossivity) has been withdrawn. It is no longer visible from 4 peers.'
                    });

                expect(message).to.contain
                    .keys([
                        "latest",
                        "earliest",
                        "data"
                    ]);

                done();
            });

        }).timeout(10000);


        it("hijack reporting", function(done) {

            pubSub.publish("test-type", "hijack");

            pubSub.subscribe("hijack", function (type, message) {

                expect(message).to
                    .containSubset({
                        "affected": 4713,
                        "data": [
                            {
                                "extra": {},
                                "matchedMessage": {
                                    "nextHop": "124.0.0.2",
                                    "originAs": 4,
                                    "path": [
                                        1,
                                        2,
                                        3,
                                        4
                                    ],
                                    "peer": "124.0.0.2",
                                    "prefix": "180.50.120.0/22",
                                    "type": "announcement",
                                },
                                "matchedRule": {
                                    "asn": [4713],
                                    "description": "OCN prefix",
                                    "ignoreMorespecifics": false,
                                    "prefix": "180.50.120.0/21",
                                    "user": "default"
                                },
                            }
                        ],
                        "id": "4-180.50.120.0/22",
                        "message": "A new prefix 180.50.120.0/22 is announced by AS4. It should be instead 180.50.120.0/21 (OCN prefix) announced by AS4713",
                        "origin": "basic-hijack-detection",
                    });

                expect(message).to.contain
                    .keys([
                        "latest",
                        "earliest",
                        "data"
                    ]);

                done();
            });

        }).timeout(10000);


        it("newprefix reporting", function (done) {

            pubSub.publish("test-type", "newprefix");

            pubSub.subscribe("newprefix", function (type, message) {

                expect(message).to
                    .containSubset({
                        "affected": 4713,
                        "data": [
                            {
                                "extra": {},
                                "matchedMessage": {
                                    "nextHop": "124.0.0.2",
                                    "originAs": 4713,
                                    "path": [
                                        1,
                                        2,
                                        3,
                                        4713
                                    ],
                                    "peer": "124.0.0.2",
                                    "prefix": "180.50.120.0/22",
                                    "type": "announcement",
                                },
                                "matchedRule": {
                                    "asn": [4713],
                                    "description": "OCN prefix",
                                    "ignoreMorespecifics": false,
                                    "prefix": "180.50.120.0/21",
                                    "user": "default"
                                },
                            }
                        ],
                        "id": "4713-180.50.120.0/22",
                        "message": "Possible change of configuration. A new prefix 180.50.120.0/22 is announced by AS4713. It is a more specific of 180.50.120.0/21 (OCN prefix).",
                        "origin": "prefix-detection",
                    });

                expect(message).to.contain
                    .keys([
                        "latest",
                        "earliest",
                        "data"
                    ]);

                done();
                setTimeout(function () {
                    process.exit()
                }, 20000);
            });

        }).timeout(10000);

    });

});