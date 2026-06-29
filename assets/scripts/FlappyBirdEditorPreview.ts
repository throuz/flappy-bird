import { _decorator, Color, Component, Label, Node, UITransform } from "cc";
import { EDITOR_NOT_IN_PREVIEW } from "cc/env";

const { ccclass, executeInEditMode, playOnFocus } = _decorator;

@ccclass("FlappyBirdEditorPreview")
@executeInEditMode(true)
@playOnFocus(true)
export class FlappyBirdEditorPreview extends Component {
  private readonly previewRootName = "EditorPreviewRoot";

  onLoad() {
    this.syncPreview();
  }

  onEnable() {
    this.syncPreview();
  }

  update() {
    if (!EDITOR_NOT_IN_PREVIEW) {
      return;
    }

    if (!this.node.getChildByName(this.previewRootName)) {
      this.syncPreview();
    }
  }

  private syncPreview() {
    const existing = this.node.getChildByName(this.previewRootName);

    if (!EDITOR_NOT_IN_PREVIEW) {
      if (existing) {
        existing.active = false;
      }
      return;
    }

    if (existing) {
      existing.active = true;
      return;
    }

    const canvasTransform = this.node.getComponent(UITransform);
    const width = canvasTransform?.width ?? 960;
    const height = canvasTransform?.height ?? 640;

    const root = this.createNode(this.previewRootName, this.node, width, height, 0, 0);
    this.createLabel("PreviewTitle", root, "Scene Preview", 46, 52, 0, 170, new Color(255, 255, 255, 255), true, 760, 80);
    this.createLabel("PreviewBird", root, "◉>", 56, 60, -160, 20, new Color(255, 221, 70, 255), true, 180, 72);
    this.createLabel("PreviewPipe", root, "██\n██\n██\n██\n██\n██", 32, 30, 180, 10, new Color(94, 196, 76, 255), true, 180, 220);
    this.createLabel(
      "PreviewHint",
      root,
      "這些是 Scene 預覽節點，執行時會自動隱藏",
      24,
      28,
      0,
      -170,
      new Color(220, 235, 255, 255),
      false,
      760,
      44,
    );
  }

  private createNode(name: string, parent: Node, width: number, height: number, x: number, y: number) {
    const node = new Node(name);
    node.setParent(parent);
    node.setPosition(x, y, 0);
    node.addComponent(UITransform).setContentSize(width, height);
    return node;
  }

  private createLabel(
    name: string,
    parent: Node,
    text: string,
    fontSize: number,
    lineHeight: number,
    x: number,
    y: number,
    color: Color,
    bold: boolean,
    width: number,
    height: number,
  ) {
    const node = this.createNode(name, parent, width, height, x, y);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = lineHeight;
    label.color = color;
    label.isBold = bold;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    return node;
  }
}
