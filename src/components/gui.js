const React = require('react');

const Blocks = require('./blocks');
const GreenFlag = require('./green-flag');
const Renderer = require('scratch-render');
const SpriteSelector = require('./sprite-selector');
const Stage = require('./stage');
const StopAll = require('./stop-all');
const Toolbox = require('./toolbox');
const VM = require('scratch-vm');
const VMManager = require('../lib/vm-manager');

class GUI extends React.Component {
    constructor (props) {
        super(props);
        this.animate = this.animate.bind(this);
        this.onReceiveWorkspace = this.onReceiveWorkspace.bind(this);
        this.state = {};
    }
    componentDidMount () {
        this.setState({
            toolbox: this.toolbox
        });
    }
    componentWillReceiveProps (nextProps) {
        if (this.props.projectData !== nextProps.projectData) {
            this.props.vm.loadProject(nextProps.projectData);
        }
    }
    animate () {
        this.props.vm.animationFrame();
        requestAnimationFrame(this.animate);
    }
    onReceiveWorkspace (workspace) {
        this.workspace = workspace;
        VMManager.attachWorkspace(this.props.vm, this.workspace);
        VMManager.attachMouseEvents(this.props.vm, this.stage);
        VMManager.attachKeyboardEvents(this.props.vm);
        this.renderer = new Renderer(this.stage);
        this.props.vm.attachRenderer(this.renderer);
        this.props.vm.loadProject(this.props.projectData);
        this.props.vm.start();
        requestAnimationFrame(this.animate);
    }
    render () {
        return (
            <div
                className="scratch-gui"
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0
                }}
            >
                <GreenFlag vm={this.props.vm} />
                <StopAll vm={this.props.vm} />
                <Stage stageRef={stage => this.stage = stage} />
                <SpriteSelector vm={this.props.vm} />
                <Toolbox toolboxRef={toolbox => this.toolbox = toolbox} />
                <Blocks
                    options={{
                        media: this.props.basePath + 'static/blocks-media/',
                        toolbox: this.state.toolbox
                    }}
                    vm={this.props.vm}
                    onReceiveWorkspace={this.onReceiveWorkspace}
                />
            </div>
        );
    }
}

GUI.propTypes = {
    basePath: React.PropTypes.string,
    projectData: React.PropTypes.string,
    vm: React.PropTypes.object,
};

GUI.defaultProps = {
    basePath: '/',
    vm: new VM()
};

module.exports = GUI;