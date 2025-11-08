ifndef TERMINALIZER
TERMINALIZER := $(shell command -v terminalizer 2> /dev/null)
endif
ifeq ($(TERMINALIZER),)
$(error "terminalizer is not installed. Please install it from https://github.com/faressoft/terminalizer")
endif

record:
	@terminalizer record demo -c config.yml

render:
	@terminalizer render demo

play:
	@terminalizer play demo