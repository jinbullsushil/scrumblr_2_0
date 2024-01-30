function iframeHeight() {
                    var newHeight = $(window).height();
                    var newWidth = $(window).width()-20;
                    var buffer = 100;     // space required for any other elements on the page
                    var newIframeHeight = newHeight - buffer;

                    $('iframe.fop').css('height',newIframeHeight).css('width',newWidth);    //this will aply to all iframes on the page, so you may want to make your jquery selector more specific.
                }

                // When DOM ready
                $(function() {
                    window.onresize = iframeHeight;
                    iframeHeight();
                });

     $(function(){

            var iFrames = $('iframe');

            function iResize() {

                for (var i = 0, j = iFrames.length; i < j; i++) {
                  iFrames[i].style.height = iFrames[i].contentWindow.document.body.offsetHeight + 'px';}
                }

                if ($.browser.safari || $.browser.opera) { 

                   iFrames.load(function(){
                       setTimeout(iResize, 0);
                   });

                   for (var i = 0, j = iFrames.length; i < j; i++) {
                        var iSource = iFrames[i].src;
                        iFrames[i].src = '';
                        iFrames[i].src = iSource;
                   }

                } else {
                   iFrames.load(function() { 
                       this.style.height = this.contentWindow.document.body.offsetHeight + 'px';
                   });
                }

            });