const bindAll = require('lodash.bindall');
const debounce = require('lodash.debounce');
const defaultsDeep = require('lodash.defaultsdeep');
const PropTypes = require('prop-types');
const React = require('react');
const {connect} = require('react-redux');
const VMScratchBlocks = require('../lib/blocks');
const VM = require('scratch-vm');
const Prompt = require('./prompt.jsx');
const BlocksComponent = require('../components/blocks/blocks.jsx');
const {getToolbox} = require('../lib/toolbox-xml');

const addFunctionListener = (object, property, callback) => {
    const oldFn = object[property];
    object[property] = function () {
        const result = oldFn.apply(this, arguments);
        callback.apply(this, result);
        return result;
    };
};

class Blocks extends React.Component {
    constructor (props) {
        super(props);
        this.ScratchBlocks = VMScratchBlocks(props.vm);
        bindAll(this, [
            'attachVM',
            'detachVM',
            'handlePromptStart',
            'handlePromptCallback',
            'handlePromptClose',
            'onScriptGlowOn',
            'onScriptGlowOff',
            'onBlockGlowOn',
            'onBlockGlowOff',
            'onTargetsUpdate',
            'onVisualReport',
            'onWorkspaceUpdate',
            'onWorkspaceMetricsChange',
            'setBlocks'
        ]);
        this.ScratchBlocks.prompt = this.handlePromptStart;
        this.state = {
            workspaceMetrics: {},
            prompt: null
        };
        this.onTargetsUpdate = debounce(this.onTargetsUpdate, 100);
    }
    componentDidMount () {
        const workspaceConfig = defaultsDeep({
            toolbox: getToolbox(this.props.extensions)
        }, Blocks.defaultOptions, this.props.options);
        this.workspace = this.ScratchBlocks.inject(this.blocks, workspaceConfig);
        window.workspace = this.workspace;
        // @todo change this when blockly supports UI events
        addFunctionListener(this.workspace, 'translate', this.onWorkspaceMetricsChange);
        addFunctionListener(this.workspace, 'zoom', this.onWorkspaceMetricsChange);

        this.attachVM();
    }
    shouldComponentUpdate () {
        // return this.state.prompt !== nextState.prompt || this.props.isVisible !== nextProps.isVisible;
        return true;
    }

    componentDidUpdate (prevProps) {
        if (prevProps.extensions !== this.props.extensions) {
            if (!prevProps.extensions.speech && this.props.extensions.speech) {
                this.workspace.updateToolbox(getToolbox(this.props.extensions));
                this.setToolboxSelectedItemByName('Speech');
                this.props.vm.runtime.HACK_SpeechBlocks.startSpeechRecogntion();
            }
            if (!prevProps.extensions.wedo && this.props.extensions.wedo) {
                this.workspace.updateToolbox(getToolbox(this.props.extensions));
                this.setToolboxSelectedItemByName('WeDo');
                this.props.vm.runtime.HACK_WeDo2Blocks.connect();
            }
            if (!prevProps.extensions.physics && this.props.extensions.physics) {
                this.props.vm.runtime.HACK_PhysicsBlocks.start();
            }
        }

        if (this.props.isVisible === prevProps.isVisible) {
            return;
        }

        // @todo hack to resize blockly manually in case resize happened while hidden
        // @todo hack to reload the workspace due to gui bug #413
        if (this.props.isVisible) { // Scripts tab
            this.workspace.setVisible(true);
            this.props.vm.refreshWorkspace();
            window.dispatchEvent(new Event('resize'));
            this.workspace.toolbox_.refreshSelection();
        } else {
            this.workspace.setVisible(false);
        }
    }
    componentWillUnmount () {
        this.detachVM();
        this.workspace.dispose();
    }
    setToolboxSelectedItemByName (name) {
        const categories = this.workspace.toolbox_.categoryMenu_.categories_;
        for (let i = 0; i < categories.length; i++) {
            if (categories[i].name_ === name) {
                this.workspace.toolbox_.setSelectedItem(categories[i]);
            }
        }
    }
    attachVM () {
        this.workspace.addChangeListener(this.props.vm.blockListener);
        this.flyoutWorkspace = this.workspace
            .getFlyout()
            .getWorkspace();
        this.flyoutWorkspace.addChangeListener(this.props.vm.flyoutBlockListener);
        this.flyoutWorkspace.addChangeListener(this.props.vm.monitorBlockListener);
        this.props.vm.addListener('SCRIPT_GLOW_ON', this.onScriptGlowOn);
        this.props.vm.addListener('SCRIPT_GLOW_OFF', this.onScriptGlowOff);
        this.props.vm.addListener('BLOCK_GLOW_ON', this.onBlockGlowOn);
        this.props.vm.addListener('BLOCK_GLOW_OFF', this.onBlockGlowOff);
        this.props.vm.addListener('VISUAL_REPORT', this.onVisualReport);
        this.props.vm.addListener('workspaceUpdate', this.onWorkspaceUpdate);
        this.props.vm.addListener('targetsUpdate', this.onTargetsUpdate);
    }
    detachVM () {
        this.props.vm.removeListener('SCRIPT_GLOW_ON', this.onScriptGlowOn);
        this.props.vm.removeListener('SCRIPT_GLOW_OFF', this.onScriptGlowOff);
        this.props.vm.removeListener('BLOCK_GLOW_ON', this.onBlockGlowOn);
        this.props.vm.removeListener('BLOCK_GLOW_OFF', this.onBlockGlowOff);
        this.props.vm.removeListener('VISUAL_REPORT', this.onVisualReport);
        this.props.vm.removeListener('workspaceUpdate', this.onWorkspaceUpdate);
        this.props.vm.removeListener('targetsUpdate', this.onTargetsUpdate);
    }
    updateToolboxBlockValue (id, value) {
        const block = this.workspace
            .getFlyout()
            .getWorkspace()
            .getBlockById(id);
        if (block) {
            block.inputList[0].fieldRow[0].setValue(value);
        }
    }
    onTargetsUpdate () {
        if (this.props.vm.editingTarget) {
            ['glide', 'move', 'set'].forEach(prefix => {
                this.updateToolboxBlockValue(`${prefix}x`, this.props.vm.editingTarget.x.toFixed(0));
                this.updateToolboxBlockValue(`${prefix}y`, this.props.vm.editingTarget.y.toFixed(0));
            });
        }
    }
    onWorkspaceMetricsChange () {
        const target = this.props.vm.editingTarget;
        if (target && target.id) {
            const workspaceMetrics = Object.assign({}, this.state.workspaceMetrics, {
                [target.id]: {
                    scrollX: this.workspace.scrollX,
                    scrollY: this.workspace.scrollY,
                    scale: this.workspace.scale
                }
            });
            this.setState({workspaceMetrics});
        }
    }
    onScriptGlowOn (data) {
        this.workspace.glowStack(data.id, true);
    }
    onScriptGlowOff (data) {
        this.workspace.glowStack(data.id, false);
    }
    onBlockGlowOn (data) {
        this.workspace.glowBlock(data.id, true);
    }
    onBlockGlowOff (data) {
        this.workspace.glowBlock(data.id, false);
    }
    onVisualReport (data) {
        this.workspace.reportValue(data.id, data.value);
    }
    onWorkspaceUpdate (data) {
        if (this.props.vm.editingTarget && !this.state.workspaceMetrics[this.props.vm.editingTarget.id]) {
            this.onWorkspaceMetricsChange();
        }

        this.ScratchBlocks.Events.disable();
        this.workspace.clear();

        const dom = this.ScratchBlocks.Xml.textToDom(data.xml);
        this.ScratchBlocks.Xml.domToWorkspace(dom, this.workspace);
        this.ScratchBlocks.Events.enable();

        this.updateBlockMenus();

        if (this.props.vm.editingTarget && this.state.workspaceMetrics[this.props.vm.editingTarget.id]) {
            const {scrollX, scrollY, scale} = this.state.workspaceMetrics[this.props.vm.editingTarget.id];
            this.workspace.scrollX = scrollX;
            this.workspace.scrollY = scrollY;
            this.workspace.scale = scale;
            this.workspace.resize();
        }
    }
    updateBlockMenus () {
        const target = this.props.vm.editingTarget;
        if (!target) return;
        // sound menus
        let firstSound = '';
        if (target.sprite.sounds.length > 0) {
            firstSound = target.sprite.sounds[0].name;
        }
        this.setBlockFieldValue('sound_play_menu', 'SOUND_MENU', firstSound);
        this.setBlockFieldValue('sound_play_done_menu', 'SOUND_MENU', firstSound);
        // costume menu
        let firstCostume = '';
        if (target.sprite.costumes.length > 0) {
            firstCostume = target.sprite.costumes[0].name;
        }
        this.setBlockFieldValue('looks_costume', 'COSTUME', firstCostume);
        // backdrops menu
        let firstBackdrop = '';
        const stage = this.props.vm.runtime.targets[0];
        if (stage && stage.sprite.costumes.length > 0) {
            firstBackdrop = stage.sprite.costumes[0].name;
        }
        this.setBlockFieldValue('looks_backdrops', 'BACKDROP', firstBackdrop);
        this.setBlockFieldValue('looks_backdrops_wait', 'BACKDROP', firstBackdrop);
    }
    setBlockFieldValue (id, fieldName, value) {
        const block = this.getBlockById(id);
        if (block) {
            block.setFieldValue(value, fieldName);
        }
    }
    getBlockById (id) {
        return this.workspace
            .getFlyout()
            .getWorkspace()
            .getBlockById(id);
    }
    setBlocks (blocks) {
        this.blocks = blocks;
    }
    handlePromptStart (message, defaultValue, callback) {
        this.setState({prompt: {callback, message, defaultValue}});
    }
    handlePromptCallback (data) {
        this.state.prompt.callback(data);
        this.handlePromptClose();
    }
    handlePromptClose () {
        this.setState({prompt: null});
    }
    render () {
        const {
            options, // eslint-disable-line no-unused-vars
            vm, // eslint-disable-line no-unused-vars
            isVisible, // eslint-disable-line no-unused-vars
            ...props
        } = this.props;
        return (
            <div>
                <BlocksComponent
                    componentRef={this.setBlocks}
                    {...props}
                />
                {this.state.prompt ? (
                    <Prompt
                        label={this.state.prompt.message}
                        placeholder={this.state.prompt.defaultValue}
                        title="New Variable" // @todo the only prompt is for new variables
                        onCancel={this.handlePromptClose}
                        onOk={this.handlePromptCallback}
                    />
                ) : null}
            </div>
        );
    }
}

Blocks.propTypes = {
    extensions: PropTypes.shape({
        wedo: PropTypes.bool,
        speech: PropTypes.bool
    }),
    isVisible: PropTypes.boolean,
    options: PropTypes.shape({
        media: PropTypes.string,
        zoom: PropTypes.shape({
            controls: PropTypes.boolean,
            wheel: PropTypes.boolean,
            startScale: PropTypes.number
        }),
        colours: PropTypes.shape({
            workspace: PropTypes.string,
            flyout: PropTypes.string,
            toolbox: PropTypes.string,
            toolboxSelected: PropTypes.string,
            scrollbar: PropTypes.string,
            scrollbarHover: PropTypes.string,
            insertionMarker: PropTypes.string,
            insertionMarkerOpacity: PropTypes.number,
            fieldShadow: PropTypes.string,
            dragShadowOpacity: PropTypes.number
        }),
        comments: PropTypes.bool
    }),
    vm: PropTypes.instanceOf(VM).isRequired
};

Blocks.defaultOptions = {
    zoom: {
        controls: true,
        wheel: true,
        startScale: 0.75
    },
    grid: {
        spacing: 40,
        length: 2,
        colour: '#ddd'
    },
    colours: {
        workspace: '#F9F9F9',
        flyout: '#F9F9F9',
        toolbox: '#FFFFFF',
        toolboxSelected: '#E9EEF2',
        scrollbar: '#CECDCE',
        scrollbarHover: '#CECDCE',
        insertionMarker: '#000000',
        insertionMarkerOpacity: 0.2,
        fieldShadow: 'rgba(255, 255, 255, 0.3)',
        dragShadowOpacity: 0.6
    },
    comments: false
};

Blocks.defaultProps = {
    options: Blocks.defaultOptions
};

const mapStateToProps = state => ({
    extensions: state.toolbox
});

// const mapDispatchToProps = dispatch => ({
// });

module.exports = connect(
    mapStateToProps
    // mapDispatchToProps
)(Blocks);
