//wpProQuizReady = jQuery.noop;

/**
 * Source: https://github.com/jfriend00/docReady
 */
(function(funcName, baseObj) {

    // The public function name defaults to window.wpProQuizReady
    // but you can pass in your own object and own function name and those will be used
    // if you want to put them in a different namespace
    funcName = funcName || "wpProQuizReady";
    baseObj = baseObj || window;
    var readyList = [];
    var readyFired = false;
    var readyEventHandlersInstalled = false;

    // call this when the document is ready
    // this function protects itself against being called more than once
    function ready() {
        if (!readyFired) {
            // this must be set to true before we start calling callbacks
            readyFired = true;
            for (var i = 0; i < readyList.length; i++) {
                // if a callback here happens to add new ready handlers,
                // the wpProQuizReady() function will see that it already fired
                // and will schedule the callback to run right after
                // this event loop finishes so all handlers will still execute
                // in order and no new ones will be added to the readyList
                // while we are processing the list
                readyList[i].fn.call(window, readyList[i].ctx);
            }
            // allow any closures held by these functions to free
            readyList = [];
        }
    }

    function readyStateChange() {
        if ( document.readyState === "complete" ) {
            ready();
        }
    }


    // This is the one public interface
    // wpProQuizReady(fn, context);
    // the context argument is optional - if present, it will be passed
    // as an argument to the callback
    baseObj[funcName] = function(callback, context) {
        // if ready has already fired, then just schedule the callback
        // to fire asynchronously, but right away
        if (readyFired) {
            setTimeout(function() {callback(context);}, 1);
            return;
        } else {
            // add the function and context to the list
            readyList.push({fn: callback, ctx: context});
        }
        // if document already ready to go, schedule the ready function to run
        if (document.readyState === "complete") {
            setTimeout(ready, 1);
        } else if (!readyEventHandlersInstalled) {
            // otherwise if we don't have event handlers installed, install them
            if (document.addEventListener) {
                // first choice is DOMContentLoaded event
                document.addEventListener("DOMContentLoaded", ready, false);
                // backup is window load event
                window.addEventListener("load", ready, false);
            } else {
                // must be IE
                document.attachEvent("onreadystatechange", readyStateChange);
                window.attachEvent("onload", ready);
            }
            readyEventHandlersInstalled = true;
        }
    }
})("wpProQuizReady", window);

wpProQuizReady(function () {

    var r = window.wpProQuizInitList || [];

    for(var i = 0; i < r.length; i++) {
        jQuery(r[i].id).wpProQuizFront(r[i].init);
    }
});

(function ($) {

    /**
     * @memberOf $
     */
    $.wpProQuizFront = function (element, options) {


        var global = this;
        var isrestored = false;
        global = {
            displayChecked: function (t, box, neg, disabled) {
                var c = neg ? !t.checked : t.checked;

                if (disabled)
                    c ? box.attr('disabled', 'disabled') : box.removeAttr('disabled');
                else
                    c ? box.show() : box.hide();
            },

            isEmpty: function (text) {
                text = $.trim(text);

                return (!text || 0 === text.length);
            },

            isNumber: function (number) {
                number = $.trim(number);
                return !global.isEmpty(number) && !isNaN(number);
            },

            getMceContent: function (id) {
                var editor = tinymce.editors[id];

                if (editor != undefined && !editor.isHidden()) {
                    return editor.getContent();
                }

                return $('#' + id).val();
            },

            ajaxPost: function (func, data, success) {
                var d = {
                    action: 'wp_pro_quiz_admin_ajax',
                    func: func,
                    data: data
                };

                $.post(WpProQuizGlobal.ajaxurl, d, success, 'json');
            }
        };


        var $e = $(element);
        var config = options;
        var plugin = this;
        var results = new Object();
        var catResults = new Object();
        var startTime = 0;
        var currentQuestion = null;
        var quizSolved = [];
        var lastButtonValue = "";
        var inViewQuestions = false;
        var currentPage = 1;

        var bitOptions = {
            randomAnswer: 0,
            randomQuestion: 0,
            disabledAnswerMark: 0,
            checkBeforeStart: 0,
            preview: 0,
            cors: 0,
            isAddAutomatic: 0,
            quizSummeryHide: 0,
            skipButton: 0,
            reviewQustion: 0,
            autoStart: 0,
            forcingQuestionSolve: 0,
            hideQuestionPositionOverview: 0,
            formActivated: 0,
            maxShowQuestion: 0,
            sortCategories: 0
        };

        var quizStatus = {
            isQuizStart: 0,
            isLocked: 0,
            loadLock: 0,
            isPrerequisite: 0,
            isUserStartLocked: 0
        };

        var globalNames = {
            check: 'input[name="check"]',
            next: 'input[name="next"]',
            questionList: '.wpProQuiz_questionList',
            skip: 'input[name="skip"]',
            singlePageLeft: 'input[name="wpProQuiz_pageLeft"]',
            singlePageRight: 'input[name="wpProQuiz_pageRight"]'
        };

        var globalElements = {
            back: $e.find('input[name="back"]'),
            next: $e.find(globalNames.next),
            quiz: $e.find('.wpProQuiz_quiz'),
            questionList: $e.find('.wpProQuiz_list'),
            results: $e.find('.wpProQuiz_results'),
            quizStartPage: $e.find('.wpProQuiz_text'),
            timelimit: $e.find('.wpProQuiz_time_limit'),
            toplistShowInButton: $e.find('.wpProQuiz_toplistShowInButton'),
            listItems: $()
        };

        var toplistData = {
            token: '',
            isUser: 0
        };

        var formPosConst = {
            START: 0,
            END: 1
        };

        if(localStorage.getItem('currentQuestion81')===null)
            $e.find('input[name="resumeQuiz"]').prop('type','hidden');
        else if(config.quizId ==localStorage.getItem('currentQuizID') && config.currentUserId ==localStorage.getItem('currentuserID'))
            $e.find('input[name="resumeQuiz"]').prop('type','button');

        /**
         * @memberOf timelimit
         */

        var timelimit = (function () {
            var _counter = config.timelimit;
            var _intervalId = 0;
            var instance = {};

            instance.stop = function () {
                if (_counter) {
                    window.clearInterval(_intervalId);
                    globalElements.timelimit.hide();
                }
            };

            instance.start = function () {
                if (!_counter)
                    return;

                var x = _counter * 1000;

                var $timeText = globalElements.timelimit.find('span').text(plugin.methode.parseTime(_counter));
                var $timeDiv = globalElements.timelimit.find('.wpProQuiz_progress');

                globalElements.timelimit.show();

                var beforeTime = +new Date();

                _intervalId = window.setInterval(function () {

                    var diff = (+new Date() - beforeTime);
                    var elapsedTime = x - diff;

                    if (diff >= 500) {
                        $timeText.text(plugin.methode.parseTime(Math.ceil(elapsedTime / 1000)));
                    }

                    $timeDiv.css('width', (elapsedTime / x * 100) + '%');

                    if (elapsedTime <= 0) {
                        instance.stop();
                        plugin.methode.finishQuiz(true);
                    }

                }, 16);
            };

            return instance;

        })();

        /**
         * @memberOf reviewBox
         */
        var reviewBox = new function () {

            var $contain = [], $cursor = [], $list = [], $items = [];
            var x = 0, offset = 0, diff = 0, top = 0, max = 0;
            var itemsStatus = [];

            this.init = function () {
                $contain = $e.find('.wpProQuiz_reviewQuestion');
                $cursor = $contain.find('div');
                $list = $contain.find('ol');
                $items = $list.children();
               // //////console.log($items.eq(index).css('background-color', color));
                $cursor.mousedown(function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    offset = e.pageY - $cursor.offset().top + top;

                    $(document).bind('mouseup.scrollEvent', endScroll);
                    $(document).bind('mousemove.scrollEvent', moveScroll);

                });

                $items.click(function (e) {
                    plugin.methode.showQuestion($(this).index());
                });

                $e.bind('questionSolved', function (e) {
                    //////console.log('-----1111--------itemsStatus--->>>>'+itemsStatus);
                    //////console.log('--------111-----e.values.index--->>>>'+e.values.index);
                    //////console.log('--------itemsStatus[e.values.index]-----e.values.index--->>>>'+itemsStatus[e.values.index]);

                    itemsStatus[e.values.index].solved = e.values.solved;
                    //////console.log('--------111--ss---itemsStatus--->>>>'+itemsStatus);

                    setColor(e.values.index);
                });
                $e.bind('setColorALL', function (e) {
                    //////console.log('-------------showQuestionObject--->>>>'+itemsStatus);
                    //////console.log('----showQuestionObject---------e.values.index--->>>>'+e.values.index);

                    itemsStatus[e.values.index].solved = e.values.solved;
                    //////console.log('----------ss---showQuestionObject--->>>>'+itemsStatus);

                    setColor(e.values.index);
                });

                $e.bind('changeQuestion', function (e) {
                    //////console.log('///////changeQuestion'+e.values.index);
                    $items.removeClass('wpProQuiz_reviewQuestionTarget');

                    $items.eq(e.values.index).addClass('wpProQuiz_reviewQuestionTarget');

                    scroll(e.values.index);
                });

                $e.bind('reviewQuestion', function (e) {
                    //////console.log('-------------reviewQuestion--->>>>'+itemsStatus);
                    itemsStatus[e.values.index].review = !itemsStatus[e.values.index].review;
                    setColor(e.values.index);
                });

                $contain.bind('mousewheel DOMMouseScroll', function (e) {
                    e.preventDefault();

                    var ev = e.originalEvent;
                    var w = ev.wheelDelta ? -ev.wheelDelta / 120 : ev.detail / 3;
                    var plus = 20 * w;

                    var x = top - $list.offset().top + plus;

                    if (x > max)
                        x = max;

                    if (x < 0)
                        x = 0;

                    var o = x / diff;

                    $list.attr('style', 'margin-top: ' + (-x) + 'px !important');
                    $cursor.css({top: o});

                    return false;
                });
            };

            this.show = function (save) {
                if (bitOptions.reviewQustion)
                    $contain.parent().show();

                $e.find('.wpProQuiz_reviewDiv .wpProQuiz_button2').show();

                if (save)
                    return;

                $list.attr('style', 'margin-top: 0px !important');
                $cursor.css({top: 0});

                var h = $list.outerHeight();
                var c = $contain.height();
                x = c - $cursor.height();
                offset = 0;
                max = h - c;
                diff = max / x;

                this.reset();

                if (h > 100) {
                    $cursor.show();
                }

                top = $cursor.offset().top;
            };

            this.hide = function () {
                $contain.parent().hide();
            };

            this.toggle = function () {
                if (bitOptions.reviewQustion) {
                    $contain.parent().toggle();
                    $items.removeClass('wpProQuiz_reviewQuestionTarget');
                    $e.find('.wpProQuiz_reviewDiv .wpProQuiz_button2').hide();

                    $list.attr('style', 'margin-top: 0px !important');
                    $cursor.css({top: 0});

                    var h = $list.outerHeight();
                    var c = $contain.height();
                    x = c - $cursor.height();
                    offset = 0;
                    max = h - c;
                    diff = max / x;

                    if (h > 100) {
                        $cursor.show();
                    }

                    top = $cursor.offset().top;
                }
            };

            this.reset = function () {
                for (var i = 0, c = $items.length; i < c; i++) {
                    itemsStatus[i] = {};
                }

                $items.removeClass('wpProQuiz_reviewQuestionTarget').css('background-color', '');
            };

            function scroll(index) {
                var $item = $items.eq(index);
                var iTop = $item.offset().top;
                var cTop = $contain.offset().top;
                var calc = iTop - cTop;

                if ((calc - 4) < 0 || (calc + 32) > 100) {
                    var x = cTop - $items.eq(0).offset().top - (cTop - $list.offset().top) + $item.position().top;

                    if (x > max)
                        x = max;

                    var o = x / diff;

                    $list.attr('style', 'margin-top: ' + (-x) + 'px !important');
                    $cursor.css({top: o});
                }
            }

            function setColor(index) {
               // //////console.log('$items$items$items$items$items---->:'+JSON.stringify($items));
                //////console.log('----setColor---)))))))');
                var color = '';
                var itemStatus = [{},{"solved":true}];
                //////console.log('itemsStatus------'+JSON.stringify(itemsStatus));

                //////console.log('itemStatus'+JSON.stringify(itemStatus));
                if (itemStatus.review) {
                    color = '#FFB800';
                } else if (itemStatus.solved) {
                    //////console.log('---solvedsolved----)))))))');

                    color = '#6CA54C';
                }

                $items.eq(1).css('background-color', color);
            }

            function setColorALL() {
                //////console.log('-----setCol$itemsorALL--)))))))'+JSON.stringify($items));
                var color = '';
                //////console.log('itemsStatus----setColorALL--'+JSON.stringify(itemsStatus));
                //////console.log('itemStatus'+JSON.stringify(itemStatus));

                if (itemStatus.review) {
                    color = '#FFB800';
                } else if (itemStatus.solved) {
                    //////console.log('---solvedsolved----setColorALL)))))))');

                    color = '#6CA54C';
                }
                color = '#6CA54C';
                //////console.log('-----setCol$itemsorALL--)))))))'+JSON.stringify($items));


                $items.eq(0).css('background-color', color);
            }

            function moveScroll(e) {
                e.preventDefault();

                var o = e.pageY - offset;

                if (o < 0)
                    o = 0;

                if (o > x)
                    o = x;

                var v = diff * o;

                $list.attr('style', 'margin-top: ' + (-v) + 'px !important');

                $cursor.css({top: o});
            }

            function endScroll(e) {
                e.preventDefault();

                $(document).unbind('.scrollEvent');
            }
        };

        function QuestionTimer() {
            var questionStartTime = 0;
            var currentQuestionId = -1;

            var quizStartTimer = 0;
            var isQuizStart = false;

            this.questionStart = function (questionId) {
                //////console.log('-------questionStart-----questionId-------'+questionId);

                if (currentQuestionId != -1)
                    this.questionStop();

                currentQuestionId = questionId;
                questionStartTime = +new Date();
            };

            this.questionStop = function () {
                //////console.log('-------questionStop------------');

                if (currentQuestionId == -1)
                    return;

                results[currentQuestionId].time += Math.round((new Date() - questionStartTime) / 1000);

                currentQuestionId = -1;
            };

            this.startQuiz = function () {
                //////console.log('-------startQuiz------------');
                if (isQuizStart)
                    this.stopQuiz();

                quizStartTimer = +new Date();
                isQuizStart = true;
            };

            this.stopQuiz = function () {
                //////console.log('-------stopQuiz------------');

                if (!isQuizStart)
                    return;

                results['comp'].quizTime += Math.round((new Date() - quizStartTimer) / 1000);
                isQuizStart = false;
            };

            this.init = function () {

            };

        };

        var questionTimer = new QuestionTimer();
        /**
         * @memberOf resolver
         */
        var resolver = function (name, data, $question, $questionList) {
            //////console.log('----resolver----'+name+JSON.stringify(data)+JSON.stringify($question)+ JSON.stringify($questionList));
            var correct = true;
            var points = 0;
            var isDiffPoints = $.isArray(data.points);
            var statistcAnswerData = {};

            var func = {
                singleMulti: function () {
                    var input = $questionList.find('.wpProQuiz_questionInput').attr('disabled', 'disabled');
                    var isDiffMode = data.diffMode;

                    $questionList.children().each(function (i) {
                        var $item = $(this);
                        var index = $item.data('pos');
                        var checked = input.eq(i).is(':checked');

                        if (data.correct[index]) {
                            if (!checked) {
                                correct = false;
                            } else {
                                if (isDiffPoints) {
                                    if (isDiffMode)
                                        points = data.points[index];
                                    else
                                        points += data.points[index];
                                }
                            }

                            if (data.disCorrect) {
                                correct = true;
                            } else {
                                plugin.methode.marker($item, true);
                            }

                        } else {
                            if (checked) {
                                if (!data.disCorrect) {
                                    plugin.methode.marker($item, false);
                                    correct = false;
                                } else {
                                    correct = true;
                                }

                                if (isDiffMode)
                                    points = data.points[index];
                            } else {
                                if (isDiffPoints && !isDiffMode) {
                                    points += data.points[index];
                                }
                            }
                        }
                    });
                }
            };

            func[name]();

            if (!isDiffPoints && correct) {
                points = data.points;
            }
            //////console.log('correct'+correct+'points'+points+'statistcAnswerData'+statistcAnswerData);

        };
        /**
         * @memberOf checker
         */
        var checker = function (name, data, $question, $questionList) {
            //////console.log('----checker----'+name+JSON.stringify(data)+JSON.stringify($question)+ JSON.stringify($questionList));
            var correct = true;
            var points = 0;
            var isDiffPoints = $.isArray(data.points);
            var statistcAnswerData = {};

            var func = {
                singleMulti: function () {
                    var input = $questionList.find('.wpProQuiz_questionInput').attr('disabled', 'disabled');
                    var isDiffMode = data.diffMode;

                    $questionList.children().each(function (i) {
                        var $item = $(this);
                        var index = $item.data('pos');
                        var checked = input.eq(i).is(':checked');

                        if (data.correct[index]) {
                            if (!checked) {
                                correct = false;
                            } else {
                                if (isDiffPoints) {
                                    if (isDiffMode)
                                        points = data.points[index];
                                    else
                                        points += data.points[index];
                                }
                            }

                            if (data.disCorrect) {
                                correct = true;
                            } else {
                                plugin.methode.marker($item, true);
                            }

                        } else {
                            if (checked) {
                                if (!data.disCorrect) {
                                    plugin.methode.marker($item, false);
                                    correct = false;
                                } else {
                                    correct = true;
                                }

                                if (isDiffMode)
                                    points = data.points[index];
                            } else {
                                if (isDiffPoints && !isDiffMode) {
                                    points += data.points[index];
                                }
                            }
                        }
                    });
                },

                sort_answer: function () {
                    var $items = $questionList.children();

                    $items.each(function (i, v) {
                        var $this = $(this);

                        statistcAnswerData[i] = $this.data('pos');

                        if (i == $this.data('pos')) {
                            plugin.methode.marker($this, true);

                            if (isDiffPoints) {
                                points += data.points[i];
                            }
                        } else {
                            plugin.methode.marker($this, false);
                            correct = false;
                        }
                    });

                    $items.children().css({
                        'box-shadow': '0 0',
                        'cursor': 'auto'
                    });

                    $questionList.sortable("destroy");

                    $items.sort(function (a, b) {
                        return $(a).data('pos') > $(b).data('pos') ? 1 : -1;
                    });

                    $questionList.append($items);
                },

                matrix_sort_answer: function () {
                    var $items = $questionList.children();
                    var matrix = new Array();
                    statistcAnswerData = {0: -1};

                    $items.each(function () {
                        var $this = $(this);
                        var i = $this.data('pos');
                        var $stringUl = $this.find('.wpProQuiz_maxtrixSortCriterion');
                        var $stringItem = $stringUl.children();

                        if ($stringItem.length)
                            statistcAnswerData[i] = $stringItem.data('pos');

                        if ($stringItem.length && $.inArray(String(i), String($stringItem.data('correct')).split(',')) >= 0) {
//						if(i == $stringItem.data('pos')) {
                            plugin.methode.marker($stringUl, true);

                            if (isDiffPoints) {
                                points += data.points[i];
                            }
                        } else {
                            correct = false;
                            plugin.methode.marker($stringUl, false);
                        }

                        matrix[i] = $stringUl;
                    });

                    plugin.methode.resetMatrix($question);

                    $question.find('.wpProQuiz_sortStringItem').each(function () {
                        var x = matrix[$(this).data('pos')];
                        if (x != undefined)
                            x.append(this);
                    }).css({
                        'box-shadow': '0 0',
                        'cursor': 'auto'
                    });

                    $question.find('.wpProQuiz_sortStringList, .wpProQuiz_maxtrixSortCriterion').sortable("destroy");
                },

                free_answer: function () {
                    var $li = $questionList.children();
                    var value = $li.find('.wpProQuiz_questionInput').attr('disabled', 'disabled').val();

                    if ($.inArray($.trim(value).toLowerCase(), data.correct) >= 0) {
                        plugin.methode.marker($li, true);
                    } else {
                        plugin.methode.marker($li, false);
                        correct = false;
                    }
                },

                cloze_answer: function () {
                    $questionList.find('.wpProQuiz_cloze').each(function (i, v) {
                        var $this = $(this);
                        var cloze = $this.children();
                        var input = cloze.eq(0);
                        var span = cloze.eq(1);
                        var inputText = plugin.methode.cleanupCurlyQuotes(input.val());

                        if ($.inArray(inputText, data.correct[i]) >= 0) {
                            if (isDiffPoints) {
                                points += data.points[i];
                            }

                            if (!bitOptions.disabledAnswerMark) {
                                input.css('background-color', '#B0DAB0');
                            }
                        } else {
                            if (!bitOptions.disabledAnswerMark) {
                                input.css('background-color', '#FFBABA');
                            }

                            correct = false;

                            span.show();
                        }

                        input.attr('disabled', 'disabled');
                    });
                },

                assessment_answer: function () {
                    correct = true;
                    var $input = $questionList.find('.wpProQuiz_questionInput').attr('disabled', 'disabled');
                    var val = 0;

                    $input.filter(':checked').each(function () {
                        val += parseInt($(this).val());
                    });

                    points = val;
                }
            };

            func[name]();

            if (!isDiffPoints && correct) {
                points = data.points;
            }
            //////console.log('correct'+correct+'points'+points+'statistcAnswerData'+statistcAnswerData);
            return {
                c: correct,
                p: points,
                s: statistcAnswerData
            };
        };

        /**
         *  @memberOf formClass
         */
        var formClass = new function () {
            var funcs = {
                isEmpty: function (str) {
                    str = $.trim(str);
                    return (!str || 0 === str.length);
                }

//					testValidate: function(str, type) {
//						switch (type) {
//						case 0: //None
//							return true;
//						case 1: //Text
//							return !funcs.isEmpty(str);
//						case 2: //Number
//							return !isNaN(str);
//						case 3: //E-Mail
//							return new RegExp(/^[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
//                                          .test($.trim(str));
//						}
//					}
            };

            var typeConst = {
                TEXT: 0,
                TEXTAREA: 1,
                NUMBER: 2,
                CHECKBOX: 3,
                EMAIL: 4,
                YES_NO: 5,
                DATE: 6,
                SELECT: 7,
                RADIO: 8
            };

            this.checkForm = function () {
                var check = true;

                $e.find('.wpProQuiz_forms input, .wpProQuiz_forms textarea, .wpProQuiz_forms .wpProQuiz_formFields, .wpProQuiz_forms select').each(function () {
                    var $this = $(this);
                    var isRequired = $this.data('required') == 1;
                    var type = $this.data('type');
                    var test = true;
                    var value = $.trim($this.val());

                    switch (type) {
                        case typeConst.TEXT:
                        case typeConst.TEXTAREA:
                        case typeConst.SELECT:
                            if (isRequired)
                                test = !funcs.isEmpty(value);

                            break;
                        case typeConst.NUMBER:
                            if (isRequired || !funcs.isEmpty(value))
                                test = !funcs.isEmpty(value) && !isNaN(value);

                            break;
                        case typeConst.EMAIL:
                            if (isRequired || !funcs.isEmpty(value))
                                test = !funcs.isEmpty(value) && new RegExp(/^[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
                                        .test(value);

                            break;
                        case typeConst.CHECKBOX:
                            if (isRequired)
                                test = $this.is(':checked');

                            break;
                        case typeConst.YES_NO:
                        case typeConst.RADIO:
                            if (isRequired)
                                test = $this.find('input[type="radio"]:checked').val() !== undefined;
                            break;
                        case typeConst.DATE:
                            var num = 0, co = 0;

                            $this.find('select').each(function () {
                                num++;
                                co += funcs.isEmpty($(this).val()) ? 0 : 1;
                            });

                            if (isRequired || co > 0)
                                test = num == co;

                            break;
                    }

                    if (test) {
                        $this.siblings('.wpProQuiz_invalidate').hide();
                    } else {
                        check = false;
                        $this.siblings('.wpProQuiz_invalidate').show();
                    }

                });

//				$('.wpProQuiz_forms input, .wpProQuiz_forms textarea').each(function() {
//					var $this = $(this);
//					var isRequired = $this.data('required') == 1;
//					var validate = $this.data('validate') & 0xFF;
//					var test = false;
//					var $infos = $this.parents('div:eq(0)').find('.wpProQuiz_invalidate');
//
//					if(isRequired) {
//						if($this.attr('type') == 'checkbox') {
//							if($this.is(':checked'))
//								test = true;
//
//						} else {
//							if(!funcs.isEmpty($this.val()))
//								test = true;
//						}
//
//						if(!test) {
//							check = false;
//							$infos.eq(0).show();
//						} else {
//							$infos.eq(0).hide();
//						}
//					}
//
//					if(!funcs.testValidate($this.val(), validate)) {
//						check = false;
//						$infos.eq(1).show();
//					} else {
//						$infos.eq(1).hide();
//					}
//
//				});

//				if(!check)
//					alert(WpProQuizGlobal.fieldsNotFilled);
//
                return check;
            };

            this.getFormData = function () {
                var data = {};

                $e.find('.wpProQuiz_forms input, .wpProQuiz_forms textarea, .wpProQuiz_forms .wpProQuiz_formFields, .wpProQuiz_forms select').each(function () {
                    var $this = $(this);
                    var id = $this.data('form_id');
                    var type = $this.data('type');

                    switch (type) {
                        case typeConst.TEXT:
                        case typeConst.TEXTAREA:
                        case typeConst.SELECT:
                        case typeConst.NUMBER:
                        case typeConst.EMAIL:
                            data[id] = $this.val();
                            break;
                        case typeConst.CHECKBOX:
                            data[id] = $this.is(':checked') ? 1 : 0;
                            break;
                        case typeConst.YES_NO:
                        case typeConst.RADIO:
                            data[id] = $this.find('input[type="radio"]:checked').val();
                            break;
                        case typeConst.DATE:
                            data[id] = {
                                day: $this.find('select[name="wpProQuiz_field_' + id + '_day"]').val(),
                                month: $this.find('select[name="wpProQuiz_field_' + id + '_month"]').val(),
                                year: $this.find('select[name="wpProQuiz_field_' + id + '_year"]').val()
                            };
                            break;
                    }
                });
            //////console.log('dataaaa'+JSON.stringify(data));
                return data;
            };
        };
        var restoreAllAnswerData = function (resultData) {
            ////console.log('resultData---->'+JSON.stringify(resultData));
            $e.find('.wpProQuiz_questionList').each(function () {
                var $this = $(this);
                var questionId = $this.data('question_id');
                var type = $this.data('type');
                var data = {};

                if (type == 'single' || type == 'multiple') {
                    $this.find('.wpProQuiz_questionListItem').each(function () {
                        ////console.log('inside--'+JSON.stringify(resultData[questionId]['data'][$(this).data('pos')]));
                        if(resultData[questionId]['data'][$(this).data('pos')]===1){
                           // $(this).find("input[type='checkbox'][value=" + 'pos' + "]").prop("checked", true);
                            $(this).find('.wpProQuiz_questionInput').prop("checked", true);
                            //$(this).find('.wpProQuiz_questionInput').click();

                        }

                    });
                } else if (type == 'free_answer') {
                    $this.find('.wpProQuiz_questionInput').val(resultData[questionId]['data'][0])  ;
                } else if (type == 'sort_answer') {
                    return true;
//					$this.find('.wpProQuiz_questionListItem').each(function() {
//						data[$(this).index()] = $(this).data('pos');
//					});
                } else if (type == 'matrix_sort_answer') {
                    return true;
//					$this.find('.wpProQuiz_questionListItem').each(function() {
//						data[$(this).data('pos')] = $(this).find('.wpProQuiz_answerCorrect').length;
//					});
                } else if (type == 'cloze_answer') {

                    $this.find('.wpProQuiz_cloze input').each(function () {
                        $(this).val(resultData[questionId]['data'][$(this).data('pos')]);
                    });
                } else if (type == 'assessment_answer') {
                    data[0] = '';

                    $this.find('.wpProQuiz_questionInput:checked').each(function () {
                        $(this).val(resultData[questionId]['data'][$(this).data('pos')]);
                       // data[$(this).data('index')] = $(this).val();
                    });
                }
//                resultData[questionId]['data'] = data;
  //              //////console.log('resultData[questionId][\'data\']'+JSON.stringify(resultData[questionId]['data']));

            });
        };
        var fetchAllAnswerData = function (resultData) {
            $e.find('.wpProQuiz_questionList').each(function () {
                var $this = $(this);
                var questionId = $this.data('question_id');
                var type = $this.data('type');
                var data = {};

                if (type == 'single' || type == 'multiple') {
                    $this.find('.wpProQuiz_questionListItem').each(function () {
                        data[$(this).data('pos')] = +$(this).find('.wpProQuiz_questionInput').is(':checked');
                    });
                } else if (type == 'free_answer') {
                    data[0] = $this.find('.wpProQuiz_questionInput').val();
                } else if (type == 'sort_answer') {
                    return true;
//					$this.find('.wpProQuiz_questionListItem').each(function() {
//						data[$(this).index()] = $(this).data('pos');
//					});
                } else if (type == 'matrix_sort_answer') {
                    return true;
//					$this.find('.wpProQuiz_questionListItem').each(function() {
//						data[$(this).data('pos')] = $(this).find('.wpProQuiz_answerCorrect').length;
//					});
                } else if (type == 'cloze_answer') {
                    var i = 0;
                    $this.find('.wpProQuiz_cloze input').each(function () {
                        data[i++] = $(this).val();
                    });
                } else if (type == 'assessment_answer') {
                    data[0] = '';

                    $this.find('.wpProQuiz_questionInput:checked').each(function () {
                        data[$(this).data('index')] = $(this).val();
                    });
                }
                resultData[questionId]['data'] = data;
                //////console.log('resultData[questionId][\'data\']'+JSON.stringify(resultData[questionId]['data']));

            });
        };
        var historyFilter = {
            data: {
                quizId: quizId,
                users: -1,
                pageLimit: 10,
                dateFrom: 0,
                dateTo: 0,
                generateNav: 0
            },

            changeFilter: function () {
                var getTime = function (p) {
                    var date = p.datepicker('getDate');

                    return date === null ? 0 : date.getTime() / 1000;
                };

                $.extend(this.data, {
                    users: $('#wpProQuiz_historyUser').val(),
                    pageLimit: $('#wpProQuiz_historyPageLimit').val(),
                    dateFrom: 0,
                    dateTo: 0,
                    generateNav: 1
                });

                return this.data;
            }
        };

                var quizId = $('#quizId').val();
                var historyNavigator = null;
                var overviewNavigator = null;


        plugin.methode = {

                loadBox: function (show, contain) {
                                        if (show)
                                            $('#wpProQuiz_loadDataHistory').show();
                                        else
                                            $('#wpProQuiz_loadDataHistory').hide();

                                    },
                                    loadNav: function (show, contain) {
                                        if (show)
                                            $('#historyNavigation').show();
                                        else
                                            $('#historyNavigation').hide();

                                    },
            /**
             * @memberOf plugin.methode
             */

                loadHistoryAjax: function () {
                        console.log('---ok');
                        //////console.log(historyFilter.data.generateNav);
                        //////console.log(historyNavigator.getCurrentPage());
                                                //////console.log('---end');
                        var data = $.extend({
                            page: historyFilter.data.generateNav>0 ? 1 : historyNavigator.getCurrentPage()},{
                            quizId: 1
                        }, historyFilter.data);

                        plugin.methode.loadBox(true);
                        plugin.methode.loadNav(false);
                        //////console.log(data);
                        var content = $('#wpProQuiz_historyLoadContext').hide();
    				plugin.methode.ajax({
                    action: 'wp_pro_quiz_admin_ajax',
                    func: 'statisticLoadHistory',
                    data:data
                    }, function (json) {
                            content.html(json.html).show();
                            if (json.navi)
                                historyNavigator.setNumPage(json.navi);
                            historyFilter.data.generateNav = 0;
                            plugin.methode.loadBox(false);
                            plugin.methode.loadNav(true);


                });
                                              },
            refresh: function (){
                //////console.log('--ssss-ok');
            },
            parseBitOptions: function () {
                if (config.bo) {
                    bitOptions.randomAnswer = config.bo & (1 << 0);
                    bitOptions.randomQuestion = config.bo & (1 << 1);
                    bitOptions.disabledAnswerMark = config.bo & (1 << 2);
                    bitOptions.checkBeforeStart = config.bo & (1 << 3);
                    bitOptions.preview = config.bo & (1 << 4);
                    bitOptions.isAddAutomatic = config.bo & (1 << 6);
                    bitOptions.reviewQustion = config.bo & ( 1 << 7);
                    bitOptions.quizSummeryHide = config.bo & (1 << 8);
                    bitOptions.skipButton = config.bo & (1 << 9);
                    bitOptions.autoStart = config.bo & (1 << 10);
                    bitOptions.forcingQuestionSolve = config.bo & (1 << 11);
                    bitOptions.hideQuestionPositionOverview = config.bo & (1 << 12);
                    bitOptions.formActivated = config.bo & (1 << 13);
                    bitOptions.maxShowQuestion = config.bo & (1 << 14);
                    bitOptions.sortCategories = config.bo & (1 << 15);

                    var cors = config.bo & (1 << 5);

                    if (cors && jQuery.support != undefined && jQuery.support.cors != undefined && jQuery.support.cors == false) {
                        bitOptions.cors = cors;
                    }
                }
            },

            setClozeStyle: function () {
                $e.find('.wpProQuiz_cloze input').each(function () {
                    var $this = $(this);
                    var word = "";
                    var wordLen = $this.data('wordlen');

                    for (var i = 0; i < wordLen; i++)
                        word += "w";

                    var clone = $(document.createElement("span"))
                        .css('visibility', 'hidden')
                        .text(word)
                        .appendTo($('body'));

                    var width = clone.width();

                    clone.remove();

                    $this.width(width + 5);
                });
            },

            parseTime: function (sec) {
                var seconds = parseInt(sec % 60);
                var minutes = parseInt((sec / 60) % 60);
                var hours = parseInt((sec / 3600) % 24);

                seconds = (seconds > 9 ? '' : '0') + seconds;
                minutes = (minutes > 9 ? '' : '0') + minutes;
                hours = (hours > 9 ? '' : '0') + hours;

                return hours + ':' + minutes + ':' + seconds;
            },

            cleanupCurlyQuotes: function (str) {
                str = str.replace(/\u2018/, "'");
                str = str.replace(/\u2019/, "'");

                str = str.replace(/\u201C/, '"');
                str = str.replace(/\u201D/, '"');

                return $.trim(str).toLowerCase();
            },

            resetMatrix: function (selector) {
                selector.each(function () {
                    var $this = $(this);
                    var $list = $this.find('.wpProQuiz_sortStringList');

                    $this.find('.wpProQuiz_sortStringItem').each(function () {
                        $list.append($(this));
                    });
                });
            },

            marker: function (e, correct) {
                if (!bitOptions.disabledAnswerMark) {
                    if (correct) {
                        e.addClass('wpProQuiz_answerCorrect');
                    } else {
                        e.addClass('wpProQuiz_answerIncorrect');
                    }
                }

            },
            startQuiz: function (loadData) {
                localStorage.clear();
                isrestored = false;
                if (quizStatus.loadLock) {
                    quizStatus.isQuizStart = 1;

                    return;
                }

                quizStatus.isQuizStart = 0;

                if (quizStatus.isLocked) {
                    globalElements.quizStartPage.hide();
                    $e.find('.wpProQuiz_lock').show();

                    return;
                }

                if (quizStatus.isPrerequisite) {
                    globalElements.quizStartPage.hide();
                    $e.find('.wpProQuiz_prerequisite').show();

                    return;
                }

                if (quizStatus.isUserStartLocked) {
                    globalElements.quizStartPage.hide();
                    $e.find('.wpProQuiz_startOnlyRegisteredUser').show();

                    return;
                }

                if (bitOptions.maxShowQuestion && !loadData) {
                    globalElements.quizStartPage.hide();
                    $e.find('.wpProQuiz_loadQuiz').show();

                    plugin.methode.loadQuizDataAjax(true);

                    return;
                }

                if (bitOptions.formActivated && config.formPos == formPosConst.START) {
                    if (!formClass.checkForm())
                        return;
                }

                plugin.methode.loadQuizData();

                if (bitOptions.randomQuestion) {
                    plugin.methode.random(globalElements.questionList);
                }

                if (bitOptions.randomAnswer) {
                    plugin.methode.random($e.find(globalNames.questionList));
                }

                if (bitOptions.sortCategories) {
                    plugin.methode.sortCategories();
                }

                plugin.methode.random($e.find('.wpProQuiz_sortStringList'));
                plugin.methode.random($e.find('[data-type="sort_answer"]'));

                $e.find('.wpProQuiz_listItem').each(function (i, v) {
                    var $this = $(this);
                    $this.find('.wpProQuiz_question_page span:eq(0)').text(i + 1);
                    $this.find('> h5 span').text(i + 1);

                    $this.find('.wpProQuiz_questionListItem').each(function (i, v) {
                        $(this).find('> span:not(.wpProQuiz_cloze)').text(i + 1 + '. ');
                    });
                });

                globalElements.next = $e.find(globalNames.next);

                switch (config.mode) {
                    case 3:
                        $e.find('input[name="checkSingle"]').show();
                        break;
                    case 2:
                        $e.find(globalNames.check).show();

                        if (!bitOptions.skipButton && bitOptions.reviewQustion)
                            $e.find(globalNames.skip).show();

                        break;
                    case 1:
                        $e.find('input[name="back"]').slice(1).show();
                    case 0:
                        globalElements.next.show();
                        break;
                }

                if (bitOptions.hideQuestionPositionOverview || config.mode == 3)
                    $e.find('.wpProQuiz_question_page').hide();

                //Change last name
                var $lastButton = globalElements.next.last();
                lastButtonValue = $lastButton.val();
                $lastButton.val(config.lbn);

                var $listItem = globalElements.questionList.children();

                globalElements.listItems = $e.find('.wpProQuiz_list > li');

                if (config.mode == 3) {
                    results  =  JSON.parse(localStorage.getItem('results'));
                    ////console.log('---///////results----ZZZZ////-'+JSON.stringify(results));
                    if(!jQuery.isEmptyObject(results))
                        isrestored =true;
                    plugin.methode.showSinglePage(0);
//					if(config.qpp) {
//						$listItem.slice(0, config.qpp).show();
//						$e.find(globalNames.singlePageRight).show();
//						$e.find('input[name="checkSingle"]').hide();
//					} else {
//						$listItem.show();
//					}
                } else {
                    if(localStorage.getItem('currentQuestion81')===null){
                        currentQuestion = $listItem.eq(0).show();
                        ////console.log('-----s-s-s-s-s-s-s-s-s');
                        isrestored =false;
                    }
                    else{

                        currentQuestion = $listItem.eq(localStorage.getItem('currentQuestion81')).show();
                        //////console.log('---///////////--s$$$$-s'+localStorage.getItem('currentQuestion81'));
                        //////console.log('---///////results////--s$$$$-s'+localStorage.getItem('results'));
                        results  =  JSON.parse(localStorage.getItem('results'));
                        //////console.log('---///////results----ZZZZ////-'+JSON.stringify(results));
                        isrestored =true;
                        this.showQuestionObject(currentQuestion);
                    }
                    //c
                    // localStorage.setItem('currentQuestion1', JSON.stringify(currentQuestion));

                    var questionId = currentQuestion.find(globalNames.questionList).data('question_id');
                    //////console.log('question_id--->'+questionId);
                    questionTimer.questionStart(questionId);
                }

                questionTimer.startQuiz();
                //////console.log('startQuiz--->'+questionId);

                $e.find('.wpProQuiz_sortable').parents('ul').sortable({
                    update: function (event, ui) {
                        var $p = $(this).parents('.wpProQuiz_listItem');
                        //////console.log('$p--->'+$p);

                        $e.trigger({
                            type: 'questionSolved',
                            values: {
                                item: $p,
                                index: $p.index(),
                                solved: true
                            }
                        });
                    }
                }).disableSelection();

                $e.find('.wpProQuiz_sortStringList, .wpProQuiz_maxtrixSortCriterion').sortable({
                    connectWith: '.wpProQuiz_maxtrixSortCriterion:not(:has(li)), .wpProQuiz_sortStringList',
                    placeholder: 'wpProQuiz_placehold',
                    update: function (event, ui) {
                        var $p = $(this).parents('.wpProQuiz_listItem');
                        //////console.log('$p--1->'+$p);

                        $e.trigger({
                            type: 'questionSolved',
                            values: {
                                item: $p,
                                index: $p.index(),
                                solved: true
                            }
                        });
                    }
                }).disableSelection();

                quizSolved = [];

                timelimit.start();

                startTime = +new Date();
                //////console.log('3333---///////results----ZZZZ////-'+JSON.stringify(results));
                //////console.log('isrestored??'+isrestored);
                if(jQuery.isEmptyObject(results) && !isrestored)
                    results = {
                        comp: {
                            points: 0,
                            correctQuestions: 0,
                            quizTime: 0
                        }
                    };
                //////console.log('4444---///////results----ZZZZ////-'+JSON.stringify(results));

                $e.find('.wpProQuiz_questionList').each(function () {
                    var questionId = $(this).data('question_id');
                    if(!jQuery.isEmptyObject(results[questionId])&&isrestored)
                        return false;
                    results[questionId] = {
                        time: 0,
                        solved: 0
                    };
                });
                //////console.log('5555---///////results----ZZZZ////-'+JSON.stringify(results));

                catResults = {};

                $.each(options.catPoints, function (i, v) {
                    catResults[i] = 0;
                });

                globalElements.quizStartPage.hide();
                $e.find('.wpProQuiz_loadQuiz').hide();
                globalElements.quiz.show();
                //reviewBox.show();

                if (config.mode != 3) {
                    $e.trigger({
                        type: 'changeQuestion',
                        values: {
                            item: currentQuestion,
                            index: currentQuestion.index()
                        }
                    });
                }
                ////console.log('STARAAART QUIZ RESULTS:'+JSON.stringify(results));
                if(isrestored){
                    restoreAllAnswerData(results);
                }

            },
            resumeQuiz: function (loadData) {
                console.log('resume');

                console.log('-----resumeQuiz----ok');


                quizStatus.isQuizStart = 0;
                console.log('-----resumeQuiz----ok');

                if (quizStatus.isLocked) {
                    globalElements.quizStartPage.hide();
                    $e.find('.wpProQuiz_lock').show();

                    return;
                }
                //console.log('-----resumeQuiz----ok');

                if (quizStatus.isPrerequisite) {
                    globalElements.quizStartPage.hide();
                    $e.find('.wpProQuiz_prerequisite').show();

                    return;
                }
                //console.log('-----resumeQuiz----ok');

                if (quizStatus.isUserStartLocked) {
                    globalElements.quizStartPage.hide();
                    $e.find('.wpProQuiz_startOnlyRegisteredUser').show();

                    return;
                }
                //console.log('-----resumeQuiz----ok');

                if (bitOptions.maxShowQuestion && !loadData) {
                    globalElements.quizStartPage.hide();
                    $e.find('.wpProQuiz_loadQuiz').show();

                    plugin.methode.loadQuizDataAjax(true);

                    return;
                }
                //console.log('-----resumeQuiz----ok');

                if (bitOptions.formActivated && config.formPos == formPosConst.START) {
                    if (!formClass.checkForm())
                        return;
                }

                plugin.methode.loadQuizData();

                if (bitOptions.randomQuestion) {
                    plugin.methode.random(globalElements.questionList);
                }

                if (bitOptions.randomAnswer) {
                    plugin.methode.random($e.find(globalNames.questionList));
                }

                if (bitOptions.sortCategories) {
                    plugin.methode.sortCategories();
                }

                plugin.methode.random($e.find('.wpProQuiz_sortStringList'));
                plugin.methode.random($e.find('[data-type="sort_answer"]'));

                $e.find('.wpProQuiz_listItem').each(function (i, v) {
                    var $this = $(this);
                    $this.find('.wpProQuiz_question_page span:eq(0)').text(i + 1);
                    $this.find('> h5 span').text(i + 1);

                    $this.find('.wpProQuiz_questionListItem').each(function (i, v) {
                        $(this).find('> span:not(.wpProQuiz_cloze)').text(i + 1 + '. ');
                    });
                });

                globalElements.next = $e.find(globalNames.next);

                switch (config.mode) {
                    case 3:
                        $e.find('input[name="checkSingle"]').show();
                        break;
                    case 2:
                        $e.find(globalNames.check).show();

                        if (!bitOptions.skipButton && bitOptions.reviewQustion)
                            $e.find(globalNames.skip).show();

                        break;
                    case 1:
                        $e.find('input[name="back"]').slice(1).show();
                    case 0:
                        globalElements.next.show();
                        break;
                }

                if (bitOptions.hideQuestionPositionOverview || config.mode == 3)
                    $e.find('.wpProQuiz_question_page').hide();

                //Change last name
                var $lastButton = globalElements.next.last();
                lastButtonValue = $lastButton.val();
                $lastButton.val(config.lbn);

                var $listItem = globalElements.questionList.children();

                globalElements.listItems = $e.find('.wpProQuiz_list > li');
                //console.log('---///////results----ZZZZ////-');

                if (config.mode == 3) {
                    results  =  JSON.parse(localStorage.getItem('results'));
                    //console.log('---///////results----ZZZZ////-'+JSON.stringify(results));
                    if(!jQuery.isEmptyObject(results))
                        isrestored =true;
                    plugin.methode.showSinglePage(0);
//					if(config.qpp) {
//						$listItem.slice(0, config.qpp).show();
//						$e.find(globalNames.singlePageRight).show();
//						$e.find('input[name="checkSingle"]').hide();
//					} else {
//						$listItem.show();
//					}
                } else {
                    if(localStorage.getItem('currentQuestion81')===null){
                        currentQuestion = $listItem.eq(0).show();
                        //console.log('-----s-s-s-s-s-s-s-s-s');
                        isrestored =false;
                    }
                    else{

                        currentQuestion = $listItem.eq(localStorage.getItem('currentQuestion81')).show();
                        //console.log('---///////////--s$$$$-s'+localStorage.getItem('currentQuestion81'));
                        //////console.log('---///////results////--s$$$$-s'+localStorage.getItem('results'));
                        results  =  JSON.parse(localStorage.getItem('results'));
                        //////console.log('---///////results----ZZZZ////-'+JSON.stringify(results));
                        isrestored =true;
                        this.showQuestionObject(currentQuestion);
                }
                    //c
                   // localStorage.setItem('currentQuestion1', JSON.stringify(currentQuestion));

                    var questionId = currentQuestion.find(globalNames.questionList).data('question_id');
                    //////console.log('question_id--->'+questionId);
                    questionTimer.questionStart(questionId);
                }

                questionTimer.startQuiz();
                //////console.log('startQuiz--->'+questionId);

                $e.find('.wpProQuiz_sortable').parents('ul').sortable({
                    update: function (event, ui) {
                        var $p = $(this).parents('.wpProQuiz_listItem');
                        //////console.log('$p--->'+$p);

                        $e.trigger({
                            type: 'questionSolved',
                            values: {
                                item: $p,
                                index: $p.index(),
                                solved: true
                            }
                        });
                    }
                }).disableSelection();

                $e.find('.wpProQuiz_sortStringList, .wpProQuiz_maxtrixSortCriterion').sortable({
                    connectWith: '.wpProQuiz_maxtrixSortCriterion:not(:has(li)), .wpProQuiz_sortStringList',
                    placeholder: 'wpProQuiz_placehold',
                    update: function (event, ui) {
                        var $p = $(this).parents('.wpProQuiz_listItem');
                        //////console.log('$p--1->'+$p);

                        $e.trigger({
                            type: 'questionSolved',
                            values: {
                                item: $p,
                                index: $p.index(),
                                solved: true
                            }
                        });
                    }
                }).disableSelection();

                quizSolved = [];

                timelimit.start();

                startTime = +new Date();
                //////console.log('3333---///////results----ZZZZ////-'+JSON.stringify(results));
                //////console.log('isrestored??'+isrestored);
                if(jQuery.isEmptyObject(results) && !isrestored)
                    results = {
                        comp: {
                            points: 0,
                            correctQuestions: 0,
                            quizTime: 0
                        }
                };
                //////console.log('4444---///////results----ZZZZ////-'+JSON.stringify(results));

                $e.find('.wpProQuiz_questionList').each(function () {
                    var questionId = $(this).data('question_id');
                    if(!jQuery.isEmptyObject(results[questionId])&&isrestored)
                    return false;
                    results[questionId] = {
                        time: 0,
                        solved: 0
                    };
                });
                //////console.log('5555---///////results----ZZZZ////-'+JSON.stringify(results));

                catResults = {};

                $.each(options.catPoints, function (i, v) {
                    catResults[i] = 0;
                });

                globalElements.quizStartPage.hide();
                $e.find('.wpProQuiz_loadQuiz').hide();
                globalElements.quiz.show();
                //reviewBox.show();

                if (config.mode != 3) {
                    $e.trigger({
                        type: 'changeQuestion',
                        values: {
                            item: currentQuestion,
                            index: currentQuestion.index()
                        }
                    });
                }
                ////console.log('STARAAART QUIZ RESULTS:'+JSON.stringify(results));
                if(isrestored){
                restoreAllAnswerData(results);
                }

            },

            showSingleQuestion: function (question) {
                var page = question ? Math.ceil(question / config.qpp) : 1;

                this.showSinglePage(page);

//				plugin.methode.scrollTo($element, 1);
            },

            showSinglePage: function (page) {
                $listItem = globalElements.questionList.children().hide();

                if (!config.qpp) {
                    $listItem.show();

                    return;
                }

                page = page ? +page : 1;

                var maxPage = Math.ceil($e.find('.wpProQuiz_list > li').length / config.qpp);

                if (page > maxPage)
                    return;

                var pl = $e.find(globalNames.singlePageLeft).hide();
                var pr = $e.find(globalNames.singlePageRight).hide();
                var cs = $e.find('input[name="checkSingle"]').hide();

                if (page > 1) {
                    pl.val(pl.data('text').replace(/%d/, page - 1)).show();
                }

                if (page == maxPage) {
                    cs.show();
                } else {
                    pr.val(pr.data('text').replace(/%d/, page + 1)).show();
                }

                currentPage = page;

                var start = config.qpp * (page - 1);

                $listItem.slice(start, start + config.qpp).show();
                plugin.methode.scrollTo(globalElements.quiz);
            },

            nextQuestion: function () {
//				currentQuestion = currentQuestion.hide().next().show();
//
//				plugin.methode.scrollTo(globalElements.quiz);
//
//				$e.trigger({type: 'changeQuestion', values: {item: currentQuestion, index: currentQuestion.index()}});
//
//				if(!currentQuestion.length) {
//					plugin.methode.showQuizSummary();
//				}
                //////console.log('INDEXXX: '+currentQuestion.index());
                localStorage.setItem('currentQuestion81', currentQuestion.index()+1);
                console.log(config.currentUserId);
                console.log(config.quizId);

                localStorage.setItem('currentuserID', config.currentUserId);
                localStorage.setItem('currentQuizID', config.quizId);
                fetchAllAnswerData(results);
                //////console.log('results------------>: '+JSON.stringify(results));
                localStorage.setItem('results', JSON.stringify(results));
                this.showQuestionObject(currentQuestion.next());
            },

            prevQuestion: function () {
//				currentQuestion = currentQuestion.hide().prev().show();
//
//				plugin.methode.scrollTo(globalElements.quiz);
//
//				$e.trigger({type: 'changeQuestion', values: {item: currentQuestion, index: currentQuestion.index()}});
//
                this.showQuestionObject(currentQuestion.prev());
            },

            showQuestion: function (index) {
                var $element = globalElements.listItems.eq(index);

                if (config.mode == 3 || inViewQuestions) {
                    if (config.qpp) {
                        plugin.methode.showSingleQuestion(index + 1);
//						questionTimer.startQuiz();
//						return;
                    }
//					plugin.methode.scrollTo($e.find('.wpProQuiz_list > li').eq(index), 1);
                    plugin.methode.scrollTo($element, 1);
                    questionTimer.startQuiz();
                    return;
                }

//				currentQuestion.hide();
//
//				currentQuestion = $element.show();
//
//				plugin.methode.scrollTo(globalElements.quiz);
//
//				$e.trigger({type: 'changeQuestion', values: {item: currentQuestion, index: currentQuestion.index()}});
//
//				if(!currentQuestion.length)
//					plugin.methode.showQuizSummary();

                this.showQuestionObject($element);
            },

            showQuestionObject: function (obj) {
                   // //////console.log('obj----->'+JSON.stringify(obj))
                if (!obj.length && bitOptions.forcingQuestionSolve && bitOptions.quizSummeryHide && bitOptions.reviewQustion) {
                    for (var i = 0, c = $e.find('.wpProQuiz_listItem').length; i < c; i++) {
                        if (!quizSolved[i]) {
                            alert(WpProQuizGlobal.questionsNotSolved);
                            return false;
                        }
                    }
                }

                currentQuestion.hide();

                currentQuestion = obj.show();
                ////////console.log('currentQuestion----->'+JSON.stringify(currentQuestion))
                plugin.methode.scrollTo(globalElements.quiz);
                ////////console.log('globalElements.quiz----->'+JSON.stringify(globalElements.quiz))

                $e.trigger({
                    type: 'changeQuestion',
                    values: {
                        item: currentQuestion,
                        index: currentQuestion.index()
                    }
                });
                reviewBox.show();
                jQuery.each(config.json, function(i, val) {
                    //////console.log('_____'+i+'_------WWWWwwww>>>>>>>:'+val.id);
                   // $("#" + i).append(document.createTextNode(" - " + val));
                   // itemsStatus[i].solved = val.solved;
                });


               // itemsStatus[e.values.index].solved = currentQuestion.solved;

                $e.trigger({
                    type: 'setColor',
                    values: {
                        item: currentQuestion,
                        index: currentQuestion.index()
                    }
                });

                if (!currentQuestion.length) {
                    plugin.methode.showQuizSummary();
                } else {
                    var questionId = currentQuestion.find(globalNames.questionList).data('question_id');
                    questionTimer.questionStart(questionId);
                }
                localStorage.setItem('currentQuestion', currentQuestion);

            },

            skipQuestion: function () {
                $e.trigger({
                    type: 'skipQuestion',
                    values: {
                        item: currentQuestion,
                        index: currentQuestion.index()
                    }
                });

                plugin.methode.nextQuestion();
            },

            reviewQuestion: function () {
                $e.trigger({
                    type: 'reviewQuestion',
                    values: {
                        item: currentQuestion,
                        index: currentQuestion.index()
                    }
                });
            },

            showQuizSummary: function () {
                questionTimer.questionStop();
                questionTimer.stopQuiz();

                if (bitOptions.quizSummeryHide || !bitOptions.reviewQustion) {
                    if (bitOptions.formActivated && config.formPos == formPosConst.END) {
                        reviewBox.hide();
                        globalElements.quiz.hide();
                        plugin.methode.scrollTo($e.find('.wpProQuiz_infopage').show());
                    } else {
                        plugin.methode.finishQuiz();
                    }

                    return;
                }

                var quizSummary = $e.find('.wpProQuiz_checkPage');

                quizSummary.find('ol:eq(0)').empty()
                    .append($e.find('.wpProQuiz_reviewQuestion ol li').clone().removeClass('wpProQuiz_reviewQuestionTarget'))
                    .children().click(function (e) {
                        quizSummary.hide();
                        globalElements.quiz.show();
                        reviewBox.show(true);

                        plugin.methode.showQuestion($(this).index());
                    });

                var cSolved = 0;

                for (var i = 0, c = quizSolved.length; i < c; i++) {
                    if (quizSolved[i]) {
                        cSolved++;
                    }
                }

                quizSummary.find('span:eq(0)').text(cSolved);

                reviewBox.hide();
                globalElements.quiz.hide();

                quizSummary.show();

                plugin.methode.scrollTo(quizSummary);
            },

            finishQuiz: function (timeover) {
                questionTimer.questionStop();
                questionTimer.stopQuiz();
                timelimit.stop();

                var time = (+new Date() - startTime) / 1000;
                time = (config.timelimit && time > config.timelimit) ? config.timelimit : time;

                $e.find('.wpProQuiz_quiz_time span').text(plugin.methode.parseTime(time));

                if (timeover) {
                    globalElements.results.find('.wpProQuiz_time_limit_expired').show();
                }

                plugin.methode.checkQuestion(globalElements.questionList.children(), true);

                $e.find('.wpProQuiz_correct_answer').text(results.comp.correctQuestions);

                results.comp.result = Math.round(results.comp.points / config.globalPoints * 100 * 100) / 100;
                results.comp.solved = 0;

                //for(var i = 0; i < quizSolved.length; i++)
                //	results.comp.solved += quizSolved[i] ? 1 : 0;

                var $pointFields = $e.find('.wpProQuiz_points span');

                $pointFields.eq(0).text(results.comp.points);
                $pointFields.eq(1).text(config.globalPoints);
                $pointFields.eq(2).text(results.comp.result + '%');

                //Result-Text START
                var $resultText = $e.find('.wpProQuiz_resultsList > li').eq(plugin.methode.findResultIndex(results.comp.result));

                var formData = formClass.getFormData();

                $resultText.find('.wpProQuiz_resultForm').each(function () {
                    var $this = $(this);
                    var formId = $this.data('form_id');
                    var data = formData[formId];

                    if (typeof data === 'object') {
                        data = data['day'] + '-' + data['month'] + '-' + data['year'];
                    }

                    $this.text(data).show();
                });

                $resultText.show();

                //Result-Text END

                plugin.methode.setAverageResult(results.comp.result, false);

                this.setCategoryOverview();

                plugin.methode.sendCompletedQuiz();

                if (bitOptions.isAddAutomatic && toplistData.isUser) {
                    plugin.methode.addToplist();
                }

                reviewBox.hide();

                $e.find('.wpProQuiz_checkPage, .wpProQuiz_infopage').hide();
                globalElements.quiz.hide();
                globalElements.results.show();

                plugin.methode.scrollTo(globalElements.results);
                localStorage.clear();
                isrestored = false;
                $e.find('input[name="resumeQuiz"]').prop('type','hidden');
            },

            setCategoryOverview: function () {
                results.comp.cats = {};

                $e.find('.wpProQuiz_catOverview li').each(function () {
                    var $this = $(this);
                    var catId = $this.data('category_id');

                    if (config.catPoints[catId] === undefined) {
                        $this.hide();
                        return true;
                    }

                    var r = Math.round(catResults[catId] / config.catPoints[catId] * 100 * 100) / 100;

                    results.comp.cats[catId] = r;

                    $this.find('.wpProQuiz_catPercent').text(r + '%');

                    $this.show();
                });
            },

            questionSolved: function (e) {
                    //////console.log('-----'+e.values.index);
                    //////console.log('/////'+e.values.solved);
                quizSolved[e.values.index] = e.values.solved;

                var $questionList = e.values.item.find(globalNames.questionList);
                ////////console.log('--$questionList---'+JSON.stringify($questionList));

                var data = config.json[$questionList.data('question_id')];
                //////console.log('--data---'+JSON.stringify(data));

                results[data.id].solved = Number(e.values.fake ? results[data.id].solved : e.values.solved);
                //////console.log('---results--'+results[data.id].solved);
                //////console.log('---resultsZ--'+JSON.stringify(results));
                fetchAllAnswerData(results);
                ////console.log('results------------>: '+JSON.stringify(results));
                localStorage.setItem('results', JSON.stringify(results));
                $e.find('input[name="resumeQuiz"]').prop('type','button');
            },

            sendCompletedQuiz: function () {
                if (bitOptions.preview)
                    return;

                fetchAllAnswerData(results);

                var formData = formClass.getFormData();
                //////console.log('------------->quizId'+JSON.stringify(config.quizId));
                //////console.log('------------->results'+JSON.stringify(results));
                //////console.log('------------->formdata'+JSON.stringify(formData));

                //plugin.methode.ajax({
                //    action: 'wp_pro_quiz_completed_quiz',
                //    quizId: config.quizId,
                //    results: results,
                //    forms: formData
                //});

                plugin.methode.ajax({
                    action: 'wp_pro_quiz_admin_ajax',
                    func: 'completedQuiz',
                    data: {
                        quizId: config.quizId,
                        results: results,
                        forms: formData
                    }
                });
            },

            findResultIndex: function (p) {
                var r = config.resultsGrade;
                var index = -1;
                var diff = 999999;

                for (var i = 0; i < r.length; i++) {
                    var v = r[i];

                    if ((p >= v) && ((p - v) < diff)) {
                        diff = p - v;
                        index = i;
                    }
                }

                return index;
            },

            showQustionList: function () {
                $('#wpProQuiz_historyLoadContext').hide();
                inViewQuestions = !inViewQuestions;
                globalElements.toplistShowInButton.hide();
                globalElements.quiz.toggle();
                $e.find('.wpProQuiz_QuestionButton').hide();
                globalElements.questionList.children().show();
                reviewBox.toggle();

                $e.find('.wpProQuiz_question_page').hide();
            },

            random: function (group) {
                group.each(function () {
                    var e = $(this).children().get().sort(function () {
                        return Math.round(Math.random()) - 0.5;
                    });

                    $(e).appendTo(e[0].parentNode);
                });
            },

            sortCategories: function () {
                var e = $('.wpProQuiz_list').children().get().sort(function (a, b) {
                    var aQuestionId = $(a).find('.wpProQuiz_questionList').data('question_id');
                    var bQuestionId = $(b).find('.wpProQuiz_questionList').data('question_id');

                    return config.json[aQuestionId].catId - config.json[bQuestionId].catId;
                });

                $(e).appendTo(e[0].parentNode);
            },

            restartQuiz: function () {
                $('#wpProQuiz_historyLoadContext').hide();
                globalElements.results.hide();
                globalElements.quizStartPage.show();
                globalElements.questionList.children().hide();
                globalElements.toplistShowInButton.hide();
                reviewBox.hide();

                $e.find('.wpProQuiz_questionInput, .wpProQuiz_cloze input').removeAttr('disabled').removeAttr('checked')
                    .css('background-color', '');

//				$e.find('.wpProQuiz_cloze input').val('');
                $e.find('.wpProQuiz_questionListItem input[type="text"]').val('');

                $e.find('.wpProQuiz_answerCorrect, .wpProQuiz_answerIncorrect').removeClass('wpProQuiz_answerCorrect wpProQuiz_answerIncorrect');

                $e.find('.wpProQuiz_listItem').data('check', false);

                $e.find('.wpProQuiz_response').hide().children().hide();

                plugin.methode.resetMatrix($e.find('.wpProQuiz_listItem'));

                $e.find('.wpProQuiz_sortStringItem, .wpProQuiz_sortable').removeAttr('style');

                $e.find('.wpProQuiz_clozeCorrect, .wpProQuiz_QuestionButton, .wpProQuiz_resultsList > li').hide();

                $e.find('.wpProQuiz_question_page, input[name="tip"]').show();
                $e.find('.wpProQuiz_resultForm').text('').hide();

                globalElements.results.find('.wpProQuiz_time_limit_expired').hide();

                globalElements.next.last().val(lastButtonValue);

                inViewQuestions = false;
            },

            checkQuestion: function (list, endCheck) {
                list = (list == undefined) ? currentQuestion : list;

                list.each(function () {
                    var $this = $(this);
                    var $questionList = $this.find(globalNames.questionList);
                    var data = config.json[$questionList.data('question_id')];
                    var name = data.type;

                    questionTimer.questionStop();
                    console.lo
                    if ($this.data('check')) {
                        return true;
                    }

                    if (data.type == 'single' || data.type == 'multiple') {
                        name = 'singleMulti';
                    }

                    var result = checker(name, data, $this, $questionList);

                    $this.find('.wpProQuiz_response').show();
                    $this.find(globalNames.check).hide();
                    $this.find(globalNames.skip).hide();
                    $this.find(globalNames.next).show();

                    results[data.id].points = result.p;
                    results[data.id].correct = Number(result.c);
                    results[data.id].data = result.s;

                    results['comp'].points += result.p;

                    catResults[data.catId] += result.p;

                    if (result.c) {
                        $this.find('.wpProQuiz_correct').show();
                        results['comp'].correctQuestions += 1;
                    } else {
                        $this.find('.wpProQuiz_incorrect').show();
                    }

                    $this.find('.wpProQuiz_responsePoints').text(result.p);

                    $this.data('check', true);
                   // //////console.log('$this--->'+JSON.stringify($this));

                    if (!endCheck)
                        $e.trigger({
                            type: 'questionSolved',
                            values: {
                                item: $this,
                                index: $this.index(),
                                solved: true,
                                fake: true
                            }
                        });
                });
            },restoreAnseredQuestions: function (list) {
                list = (list == undefined) ? currentQuestion : list;

                list.each(function () {
                    var $this = $(this);
                    var $questionList = $this.find(globalNames.questionList);
                    var data = config.json[$questionList.data('question_id')];
                    var name = data.type;

                    //questionTimer.questionStop();

                    if ($this.data('check')) {
                        return true;
                    }

                    if (data.type == 'single' || data.type == 'multiple') {
                        name = 'singleMulti';
                    }

                    var result = checker(name, data, $this, $questionList);

                    $this.find('.wpProQuiz_response').show();
                    $this.find(globalNames.check).hide();
                    $this.find(globalNames.skip).hide();
                    $this.find(globalNames.next).show();

                    results[data.id].points = result.p;
                    results[data.id].correct = Number(result.c);
                    results[data.id].data = result.s;

                    results['comp'].points += result.p;

                    catResults[data.catId] += result.p;

                    if (result.c) {
                        $this.find('.wpProQuiz_correct').show();
                        results['comp'].correctQuestions += 1;
                    } else {
                        $this.find('.wpProQuiz_incorrect').show();
                    }

                    $this.find('.wpProQuiz_responsePoints').text(result.p);

                    $this.data('check', true);
                    ////////console.log('$this--->'+JSON.stringify($this));
                });
            },

            showTip: function () {
                var $this = $(this);
                var id = $this.siblings('.wpProQuiz_question').find(globalNames.questionList).data('question_id');

                $this.siblings('.wpProQuiz_tipp').toggle('fast');

                results[id].tip = 1;

                $(document).bind('mouseup.tipEvent', function (e) {

                    var $tip = $e.find('.wpProQuiz_tipp');
                    var $btn = $e.find('input[name="tip"]');

                    if (!$tip.is(e.target) && $tip.has(e.target).length == 0 && !$btn.is(e.target)) {
                        $tip.hide('fast');
                        $(document).unbind('.tipEvent');
                    }
                });
            },

            ajax: function (data, success, dataType) {
                dataType = dataType || 'json';

                if (bitOptions.cors) {
                    jQuery.support.cors = true;
                }
                $.post(WpProQuizGlobal.ajaxurl, data, success, dataType);

                if (bitOptions.cors) {
                    jQuery.support.cors = false;
                }
            },ajaxx: function (data, success, dataType,url) {
                dataType = dataType || 'json';

                if (bitOptions.cors) {
                    jQuery.support.cors = true;
                }
                $.post(url, data, success, dataType);

                if (bitOptions.cors) {
                    jQuery.support.cors = false;
                }
            },

            checkQuizLock: function () {

                quizStatus.loadLock = 1;

                plugin.methode.ajax({
                    //action: 'wp_pro_quiz_check_lock',
                    //quizId: config.quizId

                    action: 'wp_pro_quiz_admin_ajax',
                    func: 'quizCheckLock',
                    data: {
                        quizId: config.quizId
                    }
                }, function (json) {

                    if (json.lock != undefined) {
                        quizStatus.isLocked = json.lock.is;

                        if (json.lock.pre) {
                            $e.find('input[name="restartQuiz"]').hide();
                        }
                    }

                    if (json.prerequisite != undefined) {
                        quizStatus.isPrerequisite = 1;
                        $e.find('.wpProQuiz_prerequisite span').text(json.prerequisite);
                    }

                    if (json.startUserLock != undefined) {
                        quizStatus.isUserStartLocked = json.startUserLock;
                    }

                    quizStatus.loadLock = 0;

                    if (quizStatus.isQuizStart) {
                        plugin.methode.startQuiz();
                    }
                });
            },

            loadQuizData: function () {
                plugin.methode.ajax({
                    action: 'wp_pro_quiz_admin_ajax',
                    func: 'loadQuizData',
                    data: {
                        quizId: config.quizId
                    }
                }, function (json) {
                    if (json.toplist) {
                        plugin.methode.handleToplistData(json.toplist);
                    }

                    if (json.averageResult != undefined) {
                        plugin.methode.setAverageResult(json.averageResult, true);
                    }
                });

                //plugin.methode.ajax({
                //    action: 'wp_pro_quiz_load_quiz_data',
                //    quizId: config.quizId
                //}, function (json) {
                //    if (json.toplist) {
                //        plugin.methode.handleToplistData(json.toplist);
                //    }
                //
                //    if (json.averageResult != undefined) {
                //        plugin.methode.setAverageResult(json.averageResult, true);
                //    }
                //});
            },

            setAverageResult: function (p, g) {
                var v = $e.find('.wpProQuiz_resultValue:eq(' + (g ? 0 : 1) + ') > * ');

                v.eq(1).text(p + '%');
                v.eq(0).css('width', (240 * p / 100) + 'px');
            },

            handleToplistData: function (json) {
                var $tp = $e.find('.wpProQuiz_addToplist');
                var $addBox = $tp.find('.wpProQuiz_addBox').show().children('div');

                if (json.canAdd) {
                    $tp.show();
                    $tp.find('.wpProQuiz_addToplistMessage').hide();
                    $tp.find('.wpProQuiz_toplistButton').show();

                    toplistData.token = json.token;
                    toplistData.isUser = 0;

                    if (json.userId) {
                        $addBox.hide();
                        toplistData.isUser = 1;

                        if (bitOptions.isAddAutomatic) {
                            $tp.hide();
                        }
                    } else {
                        $addBox.show();

                        var $captcha = $addBox.children().eq(1);

                        if (json.captcha) {

                            $captcha.find('input[name="wpProQuiz_captchaPrefix"]').val(json.captcha.code);
                            $captcha.find('.wpProQuiz_captchaImg').attr('src', json.captcha.img);
                            $captcha.find('input[name="wpProQuiz_captcha"]').val('');

                            $captcha.show();
                        } else {
                            $captcha.hide();
                        }
                    }
                } else {
                    $tp.hide();
                }
            },

            scrollTo: function (e, h) {
                var x = e.offset().top - 100;

                if (h || (window.pageYOffset || document.body.scrollTop) > x) {
                    $('html,body').animate({scrollTop: x}, 300);
                }
            },

            addToplist: function () {
                if (bitOptions.preview)
                    return;

                var $addToplistMessage = $e.find('.wpProQuiz_addToplistMessage').text(WpProQuizGlobal.loadData).show();
                var $addBox = $e.find('.wpProQuiz_addBox').hide();

                plugin.methode.ajax({
                    //action: 'wp_pro_quiz_add_toplist',
                    //quizId: config.quizId,
                    //token: toplistData.token,
                    //name: $addBox.find('input[name="wpProQuiz_toplistName"]').val(),
                    //email: $addBox.find('input[name="wpProQuiz_toplistEmail"]').val(),
                    //captcha: $addBox.find('input[name="wpProQuiz_captcha"]').val(),
                    //prefix: $addBox.find('input[name="wpProQuiz_captchaPrefix"]').val(),
                    //points: results.comp.points,
                    //totalPoints: config.globalPoints

                    action: 'wp_pro_quiz_admin_ajax',
                    func: 'addInToplist',
                    data: {
                        quizId: config.quizId,
                        token: toplistData.token,
                        name: $addBox.find('input[name="wpProQuiz_toplistName"]').val(),
                        email: $addBox.find('input[name="wpProQuiz_toplistEmail"]').val(),
                        captcha: $addBox.find('input[name="wpProQuiz_captcha"]').val(),
                        prefix: $addBox.find('input[name="wpProQuiz_captchaPrefix"]').val(),
                        points: results.comp.points,
                        totalPoints: config.globalPoints
                    }
                }, function (json) {
                    $addToplistMessage.text(json.text);

                    if (json.clear) {
                        $addBox.hide();
                        plugin.methode.updateToplist();
                    } else {
                        $addBox.show();
                    }

                    if (json.captcha) {
                        $addBox.find('.wpProQuiz_captchaImg').attr('src', json.captcha.img);
                        $addBox.find('input[name="wpProQuiz_captchaPrefix"]').val(json.captcha.code);
                        $addBox.find('input[name="wpProQuiz_captcha"]').val('');
                    }
                });
            },

            updateToplist: function () {
                if (typeof(wpProQuiz_fetchToplist) == "function") {
                    wpProQuiz_fetchToplist();
                }
            },

            registerSolved: function () {
                $e.find('.wpProQuiz_questionInput[type="text"]').change(function (e) {
                    var $this = $(this);
                    var $p = $this.parents('.wpProQuiz_listItem');
                    var s = false;
                    ////////console.log('$p----2---'+$p);
                    if ($this.val() != '') {
                        s = true;
                    }

                    $e.trigger({
                        type: 'questionSolved',
                        values: {
                            item: $p,
                            index: $p.index(),
                            solved: s
                        }
                    });
                });

                $e.find('.wpProQuiz_questionList[data-type="single"] .wpProQuiz_questionInput, .wpProQuiz_questionList[data-type="assessment_answer"] .wpProQuiz_questionInput').change(function (e) {
                    var $this = $(this);
                    var $p = $this.parents('.wpProQuiz_listItem');
                    var s = this.checked;
                    //////console.log('-----))))----------'+JSON.stringify(results));
                    $e.trigger({
                        type: 'questionSolved',
                        values: {
                            item: $p,
                            index: $p.index(),
                            solved: s
                        }
                    });
                });

                $e.find('.wpProQuiz_cloze input').change(function () {
                    var $this = $(this);
                    var $p = $this.parents('.wpProQuiz_listItem');
                    var s = true;
                    //////console.log('-----))$p))----------');

                    $p.find('.wpProQuiz_cloze input').each(function () {
                        if ($(this).val() == '') {
                            s = false;
                            return false;
                        }
                    });

                    $e.trigger({
                        type: 'questionSolved',
                        values: {
                            item: $p,
                            index: $p.index(),
                            solved: s
                        }
                    });
                });

                $e.find('.wpProQuiz_questionList[data-type="multiple"] .wpProQuiz_questionInput').change(function (e) {
                    var $this = $(this);
                    var $p = $this.parents('.wpProQuiz_listItem');
                    var c = 0;
                    //////console.log('-----))$p))----------');

                    $p.find('.wpProQuiz_questionList[data-type="multiple"] .wpProQuiz_questionInput').each(function (e) {
                        if (this.checked)
                            c++;
                    });

                    $e.trigger({
                        type: 'questionSolved',
                        values: {
                            item: $p,
                            index: $p.index(),
                            solved: (c) ? true : false
                        }
                    });

                });
            },

            loadQuizDataAjax: function (quizStart) {
                    //////console.log('---------///////<<<<<<');
                plugin.methode.ajax({
                    action: 'wp_pro_quiz_admin_ajax',
                    func: 'quizLoadData',
                    data: {
                        quizId: config.quizId
                    }
                }, function (json) {

                    config.globalPoints = json.globalPoints;
                    config.catPoints = json.catPoints;
                    config.json = json.json;

                    globalElements.quiz.remove();

                    $e.find('.wpProQuiz_quizAnker').after(json.content);

                    //Reinit globalElements
                    globalElements = {
                        back: $e.find('input[name="back"]'),
                        next: $e.find(globalNames.next),
                        quiz: $e.find('.wpProQuiz_quiz'),
                        questionList: $e.find('.wpProQuiz_list'),
                        results: $e.find('.wpProQuiz_results'),
                        quizStartPage: $e.find('.wpProQuiz_text'),
                        timelimit: $e.find('.wpProQuiz_time_limit'),
                        toplistShowInButton: $e.find('.wpProQuiz_toplistShowInButton'),
                        listItems: $()
                    };

                    plugin.methode.initQuiz();

                    if (quizStart)
                        plugin.methode.startQuiz(true);

                });
            },

            initQuiz: function () {
                plugin.methode.setClozeStyle();
                plugin.methode.registerSolved();

                globalElements.next.click(function () {
                    if (bitOptions.forcingQuestionSolve && !quizSolved[currentQuestion.index()]
                        && (bitOptions.quizSummeryHide || !bitOptions.reviewQustion)) {

                        alert(WpProQuizGlobal.questionNotSolved);
                        return false;
                    }

                    plugin.methode.nextQuestion();
                });

                globalElements.back.click(function () {
                    plugin.methode.prevQuestion();
                });

                $e.find(globalNames.check).click(function () {
                    if (bitOptions.forcingQuestionSolve && !quizSolved[currentQuestion.index()]
                        && (bitOptions.quizSummeryHide || !bitOptions.reviewQustion)) {

                        alert(WpProQuizGlobal.questionNotSolved);
                        return false;
                    }

                    plugin.methode.checkQuestion();
                });

                $e.find('input[name="checkSingle"]').click(function () {
                    if (bitOptions.forcingQuestionSolve && (bitOptions.quizSummeryHide || !bitOptions.reviewQustion)) {
                        for (var i = 0, c = $e.find('.wpProQuiz_listItem').length; i < c; i++) {
                            if (!quizSolved[i]) {
                                alert(WpProQuizGlobal.questionsNotSolved);
                                return false;
                            }
                        }
                    }

                    plugin.methode.showQuizSummary();
                });

                $e.find('input[name="tip"]').click(plugin.methode.showTip);
                $e.find('input[name="skip"]').click(plugin.methode.skipQuestion);

                $e.find('input[name="wpProQuiz_pageLeft"]').click(function () {
                    plugin.methode.showSinglePage(currentPage - 1);
                });

                $e.find('input[name="wpProQuiz_pageRight"]').click(function () {
                    plugin.methode.showSinglePage(currentPage + 1);
                });
            }
        };

//		/**
//		 * @memberOf plugin
//		 */
//		plugin.init = function() {
//			//
//			plugin.methode.setClozeStyle();
//			//
//			plugin.methode.registerSolved();
//
//
//			reviewBox.init();
//
//			if(bitOptions.checkBeforeStart && !bitOptions.preview) {
//				plugin.methode.checkQuizLock();
//			}
//
//			$e.find('input[name="startQuiz"]').click(function() {
//				plugin.methode.startQuiz();
//				return false;
//			});
//
//			//
//			globalElements.next.click(function() {
//				if(bitOptions.forcingQuestionSolve && !quizSolved[currentQuestion.index()]
//						&& (bitOptions.quizSummeryHide || !bitOptions.reviewQustion)) {
//
//					alert(WpProQuizGlobal.questionNotSolved);
//					return false;
//				}
//
//				plugin.methode.nextQuestion();
//			});
//
//			//
//			globalElements.back.click(function() {
//				plugin.methode.prevQuestion();
//			});
//
//			$e.find('input[name="reShowQuestion"]').click(function() {
//				plugin.methode.showQustionList();
//			});
//
//			$e.find('input[name="restartQuiz"]').click(function() {
//				plugin.methode.restartQuiz();
//			});
//
//			//
//			$e.find(globalNames.check).click(function() {
//				if(bitOptions.forcingQuestionSolve && !quizSolved[currentQuestion.index()]
//						&& (bitOptions.quizSummeryHide || !bitOptions.reviewQustion)) {
//
//					alert(WpProQuizGlobal.questionNotSolved);
//					return false;
//				}
//
//				plugin.methode.checkQuestion();
//			});
//
//			//
//			$e.find('input[name="checkSingle"]').click(function() {
//				if(bitOptions.forcingQuestionSolve	&& (bitOptions.quizSummeryHide || !bitOptions.reviewQustion)) {
//					for(var i = 0, c = $e.find('.wpProQuiz_listItem').length; i < c; i++) {
//						if(!quizSolved[i]) {
//							alert(WpProQuizGlobal.questionsNotSolved);
//							return false;
//						}
//					}
//				}
//
//				plugin.methode.showQuizSummary();
//			});
//
//			//
//			$e.find('input[name="tip"]').click(plugin.methode.showTip);
//
//			//
//			$e.find('input[name="skip"]').click(plugin.methode.skipQuestion);
//
//			$e.find('input[name="review"]').click(plugin.methode.reviewQuestion);
//
//			$e.find('input[name="wpProQuiz_toplistAdd"]').click(plugin.methode.addToplist);
//
//			$e.find('input[name="quizSummary"]').click(plugin.methode.showQuizSummary);
//
//			$e.find('input[name="endQuizSummary"]').click(function() {
//				if(bitOptions.forcingQuestionSolve) {
//					for(var i = 0, c = $e.find('.wpProQuiz_listItem').length; i < c; i++) {
//						if(!quizSolved[i]) {
//							alert(WpProQuizGlobal.questionsNotSolved);
//							return false;
//						}
//					}
//				}
//
//				if(bitOptions.formActivated && config.formPos == formPosConst.END && !formClass.checkForm())
//					return;
//
//				plugin.methode.finishQuiz();
//			});
//
//			$e.find('input[name="endInfopage"]').click(function() {
//				if(formClass.checkForm())
//					plugin.methode.finishQuiz();
//			});
//
//			$e.find('input[name="showToplist"]').click(function() {
//				globalElements.quiz.hide();
//				globalElements.toplistShowInButton.toggle();
//			});
//
//			//
//			$e.find('input[name="wpProQuiz_pageLeft"]').click(function() {
//				plugin.methode.showSinglePage(currentPage-1);
//			});
//
//			//
//			$e.find('input[name="wpProQuiz_pageRight"]').click(function() {
//				plugin.methode.showSinglePage(currentPage+1);
//			});
//
//			$e.bind('questionSolved', plugin.methode.questionSolved);
//		};

        /**
         * @memberOf plugin
         */
        plugin.preInit = function () {
            //console.log('---------ok');
            historyNavigator = new Navigator($('#historyNavigation'), {
                        onChange: function () {
                            plugin.methode.loadHistoryAjax();
                        }
                    });
            plugin.methode.parseBitOptions();
            reviewBox.init();

            $e.find('input[name="startQuiz"]').click(function () {
                plugin.methode.startQuiz();
                return false;
            });
            $e.find('input[name="resumeQuiz"]').click(function () {
                plugin.methode.resumeQuiz();
                return false;
            });

            if (bitOptions.checkBeforeStart && !bitOptions.preview) {
                plugin.methode.checkQuizLock();
            }

            $e.find('input[name="reShowQuestion"]').click(function () {
                plugin.methode.showQustionList();
            });
             $e.find('input[name="filterHistory"]').click(function () {

                plugin.methode.loadHistoryAjax();
            });
            $e.find('input[name="filter"]').click(function () {
                plugin.methode.refresh();
            });

            $e.find('input[name="restartQuiz"]').click(function () {

                plugin.methode.restartQuiz();
            });

            $e.find('input[name="review"]').click(plugin.methode.reviewQuestion);

            $e.find('input[name="wpProQuiz_toplistAdd"]').click(plugin.methode.addToplist);

            $e.find('input[name="quizSummary"]').click(plugin.methode.showQuizSummary);

            $e.find('input[name="endQuizSummary"]').click(function () {
                if (bitOptions.forcingQuestionSolve) {
                    for (var i = 0, c = $e.find('.wpProQuiz_listItem').length; i < c; i++) {
                        if (!quizSolved[i]) {
                            alert(WpProQuizGlobal.questionsNotSolved);
                            return false;
                        }
                    }
                }

                if (bitOptions.formActivated && config.formPos == formPosConst.END && !formClass.checkForm())
                    return;

                plugin.methode.finishQuiz();
            });

            $e.find('input[name="endInfopage"]').click(function () {
                if (formClass.checkForm())
                    plugin.methode.finishQuiz();
            });

            $e.find('input[name="showToplist"]').click(function () {
                globalElements.quiz.hide();
                globalElements.toplistShowInButton.toggle();
            });

            $e.bind('questionSolved', plugin.methode.questionSolved);

            if (!bitOptions.maxShowQuestion) {
                //////console.log('-----initQuiz----ok');

                plugin.methode.initQuiz();
            }
            reviewBox.show();
            //console.log('-----autoStart----ok');

            if (bitOptions.autoStart)
                plugin.methode.resumeQuiz();
        };

        plugin.preInit();
    };



    $.fn.wpProQuizFront = function (options) {

        var config = options;
        config['formPos']=1;
        //////console.log(JSON.stringify(config));
        var isrestored = false;
        var bitOptions = {
            randomAnswer: 0,
            randomQuestion: 0,
            disabledAnswerMark: 0,
            checkBeforeStart: 0,
            preview: 0,
            cors: 0,
            isAddAutomatic: 0,
            quizSummeryHide: 0,
            skipButton: 0,
            reviewQustion: 0,
            autoStart: 0,
            forcingQuestionSolve: 0,
            hideQuestionPositionOverview: 0,
            formActivated: 0,
            maxShowQuestion: 0,
            sortCategories: 0
        };

       // var partsOfStr = ($('#quizId').val()).split(',');

        var historyFilter = {
            data: {
                quizId: config.quizId,
                users: -1,
                pageLimit: 10,
                dateFrom: 0,
                dateTo: 0,
                generateNav: 1
            },

            changeFilter: function () {
                var getTime = function (p) {
                    var date = p.datepicker('getDate');

                    return date === null ? 0 : date.getTime() / 1000;
                };

                $.extend(this.data, {
                    quizId: $('#wpProQuiz_historyUser').val(),
                    users: $('#wpProQuiz_historyUser').val(),
                    pageLimit: $('#wpProQuiz_historyPageLimit').val(),
                    dateFrom: 0,
                    dateTo: 0,
                    generateNav: 1
                });

                return this.data;
            }
        };
        var quizId =  config.quizId;
        var historyNavigator = null;

        methode = {
            loadBox: function (show, contain) {
                if (show)
                    $('#wpProQuiz_loadDataHistory').show();
                else
                    $('#wpProQuiz_loadDataHistory').hide();

            },
            loadNav: function (show, contain) {
                if (show)
                    $('#historyNavigation').show();
                else
                    $('#historyNavigation').hide();

            },
            loadHistoryAjax: function () {
              console.log('--s-ok');
                //////console.log(historyFilter.data.generateNav);
                //////console.log(historyNavigator.getCurrentPage());
                //////console.log('---end'+config.quizId);
                var data = $.extend({
                    page: historyFilter.data.generateNav>0 ? 1 : historyNavigator.getCurrentPage()},{
                    quizId: config.quizId
                }, historyFilter.data);

                methode.loadBox(true);
                methode.loadNav(false);
                //////console.log(data);
                var content = $('#wpProQuiz_historyLoadContext').hide();
                methode.ajax({
                    action: 'wp_pro_quiz_admin_ajax',
                    func: 'statisticLoadHistory',
                    data:data
                }, function (json) {
                    content.html(json.html).show();
                    if (json.navi)
                        historyNavigator.setNumPage(json.navi);
                    historyFilter.data.generateNav = 0;
                    methode.loadBox(false);
                    methode.loadNav(true);


                });
            },
            refresh: function (){
                //////console.log('--ssss-ok');
            },  parseBitOptions: function () {
                if (config.bo) {
                    bitOptions.randomAnswer = config.bo & (1 << 0);
                    bitOptions.randomQuestion = config.bo & (1 << 1);
                    bitOptions.disabledAnswerMark = config.bo & (1 << 2);
                    bitOptions.checkBeforeStart = config.bo & (1 << 3);
                    bitOptions.preview = config.bo & (1 << 4);
                    bitOptions.isAddAutomatic = config.bo & (1 << 6);
                    bitOptions.reviewQustion = config.bo & ( 1 << 7);
                    bitOptions.quizSummeryHide = config.bo & (1 << 8);
                    bitOptions.skipButton = config.bo & (1 << 9);
                    bitOptions.autoStart = config.bo & (1 << 10);
                    bitOptions.forcingQuestionSolve = config.bo & (1 << 11);
                    bitOptions.hideQuestionPositionOverview = config.bo & (1 << 12);
                    bitOptions.formActivated = config.bo & (1 << 13);
                    bitOptions.maxShowQuestion = config.bo & (1 << 14);
                    bitOptions.sortCategories = config.bo & (1 << 15);

                    var cors = config.bo & (1 << 5);

                    if (cors && jQuery.support != undefined && jQuery.support.cors != undefined && jQuery.support.cors == false) {
                        bitOptions.cors = cors;
                    }
                }
            },
            ajax: function (data, success, dataType) {
                dataType = dataType || 'json';

                if (bitOptions.cors) {
                    jQuery.support.cors = true;
                }
                $.post(WpProQuizGlobal.ajaxurl, data, success, dataType);

                if (bitOptions.cors) {
                    jQuery.support.cors = false;
                }
            }};
        var preInit = function () {
            //console.log('---sss---z---ok');
            historyNavigator = new Navigator($('#historyNavigation'), {
                onChange: function () {
                    methode.loadHistoryAjax();
                }
            });
            methode.parseBitOptions();

            $(document).ready(function() {
                var $myDiv = $('#wpProQuiz_historyLoadContextNo');

                if ( !$myDiv.length){
                    methode.loadHistoryAjax();

                }


            });


        };
        preInit();


        $('.wpProQuiz_update').click(function () {
            methode.loadHistoryAjax();
        });
        $('#filter').click(function () {
            historyFilter.changeFilter();
            methode.loadHistoryAjax();
        });
        return this.each(function () {
            if (undefined == $(this).data('wpProQuizFront')) {
                $(this).data('wpProQuizFront', new $.wpProQuizFront(this, options));
            }
        });

    };


    function Navigator(obj, option) {
        var defaultOption = {
            onChange: null
        };

        var elements = {
            contain: null,
            pageLeft: null,
            pageRight: null,
            currentPage: null
        };

        var checkNavBar = function () {
            var num = elements.currentPage.children().length;
            //////console.log('-max-num--'+num);
            var cur = Number(elements.currentPage.val());
            //////console.log('-cur-num--'+cur);

            elements.pageLeft.hide();
            elements.pageRight.hide();

            if (cur > 1)
                elements.pageLeft.show();

            if ((cur + 1) <= num)
                elements.pageRight.show();
        };

        var init = function () {

            $.extend(elements, {
                contain: obj,
                pageLeft: obj.find('.navigationLeft'),
                pageRight: obj.find('.navigationRight'),
                currentPage: obj.find('.navigationCurrentPage')
            });

            $.extend(defaultOption, option);

            elements.pageLeft.click(function () {
                elements.currentPage.val(Number(elements.currentPage.val()) - 1);
                checkNavBar();

                if (defaultOption.onChange)
                    defaultOption.onChange(elements.currentPage.val());
            });

            elements.pageRight.click(function () {
                elements.currentPage.val(Number(elements.currentPage.val()) + 1);
                checkNavBar();

                if (defaultOption.onChange)
                    defaultOption.onChange(elements.currentPage.val());
            });

            elements.currentPage.change(function () {
                checkNavBar();

                if (defaultOption.onChange)
                {
                    //////console.log('-page:'+elements.currentPage.val());
                    defaultOption.onChange(elements.currentPage.val());
                }
            });
            //////console.log('nice');
        };

        this.getCurrentPage = function () {
            return elements.currentPage.val();
        }

        this.setNumPage = function (num) {
                //////console.log('-------numpage'+num);
            elements.currentPage.empty();

            for (var i = 1; i <= num; i++) {
                $(document.createElement('option'))
                    .val(i)
                    .text(i)
                    .appendTo(elements.currentPage);
            }

            checkNavBar();
        }

        init();
    }
})(jQuery);