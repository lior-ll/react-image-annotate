// @flow

import React, { useState, useRef, useCallback } from "react"
import type { Node } from "react"
import Grid from "@material-ui/core/Grid"
import { makeStyles } from "@material-ui/core/styles"
import Sidebar from "../Sidebar"
import ImageCanvas from "../ImageCanvas"
import Header from "../Header"
import IconTools from "../IconTools"
import styles from "./styles"
import type { MainLayoutState, Action } from "./types"
import useKey from "use-key-hook"
import classnames from "classnames"
import { useSettings } from "../SettingsProvider"
import SettingsDialog from "../SettingsDialog"
import Fullscreen from "../Fullscreen"
import getActiveImage from "../Annotator/reducers/get-active-image"
import useImpliedVideoRegions from "./use-implied-video-regions"
import { useDispatchHotkeyHandlers } from "../ShortcutsManager"
import { withHotKeys } from "react-hotkeys"
import iconDictionary from "./icon-dictionary"
import KeyframeTimeline from "../KeyframeTimeline"
import Workspace from "react-material-workspace-layout/Workspace"
import DebugBox from "../DebugSidebarBox"
import TagsSidebarBox from "../TagsSidebarBox"
import KeyframesSelector from "../KeyframesSelectorSidebarBox"
import TaskDescription from "../TaskDescriptionSidebarBox"
import RegionSelector from "../RegionSelectorSidebarBox"
import ImageSelector from "../ImageSelectorSidebarBox"
import HistorySidebarBox from "../HistorySidebarBox"

const emptyArr = []
const useStyles = makeStyles(styles)

const HotkeyDiv = withHotKeys(({ hotKeys, children, divRef, ...props }) => (
  <div {...{ ...hotKeys, ...props }} ref={divRef}>
    {children}
  </div>
))

type Props = {
  state: MainLayoutState,
  RegionEditLabel?: Node,
  dispatch: (Action) => any,
  alwaysShowNextButton?: boolean,
  alwaysShowPrevButton?: boolean,
  onRegionClassAdded: () => {},
}

export const MainLayout = ({
  state,
  dispatch,
  alwaysShowNextButton = false,
  alwaysShowPrevButton = false,
  RegionEditLabel,
  onRegionClassAdded,
}: Props) => {
  const classes = useStyles()
  const settings = useSettings()

  const memoizedActionFns = useRef({})
  const action = (type: string, ...params: Array<string>) => {
    const fnKey = `${type}(${params.join(",")})`
    if (memoizedActionFns.current[fnKey])
      return memoizedActionFns.current[fnKey]

    const fn = (...args: any) =>
      params.length > 0
        ? dispatch(
            ({
              type,
              ...params.reduce((acc, p, i) => ((acc[p] = args[i]), acc), {}),
            }: any)
          )
        : dispatch({ type, ...args[0] })
    memoizedActionFns.current[fnKey] = fn
    return fn
  }

  const { currentImageIndex, activeImage } = getActiveImage(state)
  let nextImage
  if (currentImageIndex !== null) {
    nextImage = state.images[currentImageIndex + 1]
  }

  useKey(() => dispatch({ type: "CANCEL" }), {
    detectKeys: [27],
  })

  const isAVideoFrame = activeImage && activeImage.frameTime !== undefined
  const innerContainerRef = useRef()
  const hotkeyHandlers = useDispatchHotkeyHandlers({ dispatch })

  let impliedVideoRegions = useImpliedVideoRegions(state)

  const refocusOnMouseEvent = useCallback((e) => {
    if (!innerContainerRef.current) return
    if (innerContainerRef.current.contains(document.activeElement)) return
    if (innerContainerRef.current.contains(e.target)) {
      innerContainerRef.current.focus()
      e.target.focus()
    }
  }, [])

  const canvas = (
    <ImageCanvas
      {...settings}
      key={state.selectedImage}
      showMask={state.showMask}
      fullImageSegmentationMode={state.fullImageSegmentationMode}
      autoSegmentationOptions={state.autoSegmentationOptions}
      showTags={state.showTags}
      allowedArea={state.allowedArea}
      regionClsList={state.regionClsList}
      regionTagList={state.regionTagList}
      regions={
        state.annotationType === "image"
          ? activeImage.regions || []
          : impliedVideoRegions
      }
      realSize={activeImage ? activeImage.realSize : undefined}
      videoPlaying={state.videoPlaying}
      imageSrc={state.annotationType === "image" ? state.selectedImage : null}
      videoSrc={state.annotationType === "video" ? state.videoSrc : null}
      pointDistancePrecision={state.pointDistancePrecision}
      createWithPrimary={state.selectedTool.includes("create")}
      dragWithPrimary={state.selectedTool === "pan"}
      zoomWithPrimary={state.selectedTool === "zoom"}
      showPointDistances={state.showPointDistances}
      pointDistancePrecision={state.pointDistancePrecision}
      videoTime={
        state.annotationType === "image"
          ? state.selectedImageFrameTime
          : state.currentVideoTime
      }
      onMouseMove={action("MOUSE_MOVE")}
      onMouseDown={action("MOUSE_DOWN")}
      onMouseUp={action("MOUSE_UP")}
      onChangeRegion={action("CHANGE_REGION", "region")}
      onBeginRegionEdit={action("OPEN_REGION_EDITOR", "region")}
      onCloseRegionEdit={action("CLOSE_REGION_EDITOR", "region")}
      onDeleteRegion={action("DELETE_REGION", "region")}
      onBeginBoxTransform={action("BEGIN_BOX_TRANSFORM", "box", "directions")}
      onBeginMovePolygonPoint={action(
        "BEGIN_MOVE_POLYGON_POINT",
        "polygon",
        "pointIndex"
      )}
      onAddPolygonPoint={action(
        "ADD_POLYGON_POINT",
        "polygon",
        "point",
        "pointIndex"
      )}
      onSelectRegion={action("SELECT_REGION", "region")}
      onBeginMovePoint={action("BEGIN_MOVE_POINT", "point")}
      onImageLoaded={action("IMAGE_LOADED", "image")}
      RegionEditLabel={RegionEditLabel}
      onImageOrVideoLoaded={action("IMAGE_OR_VIDEO_LOADED", "metadata")}
      onChangeVideoTime={action("CHANGE_VIDEO_TIME", "newTime")}
      onChangeVideoPlaying={action("CHANGE_VIDEO_PLAYING", "isPlaying")}
      onRegionClassAdded={onRegionClassAdded}
    />
  )

  const debugModeOn = Boolean(window.localStorage.$ANNOTATE_DEBUG_MODE && state)

  return (
    <Workspace
      allowFullscreen
      iconDictionary={iconDictionary}
      headerLeftSide={[
        state.annotationType === "video" && (
          <KeyframeTimeline
            currentTime={state.currentVideoTime}
            duration={state.videoDuration}
            onChangeCurrentTime={action("CHANGE_VIDEO_TIME", "newTime")}
            keyframes={state.keyframes}
          />
        ),
      ].filter(Boolean)}
      headerItems={[
        { name: "Prev" },
        { name: "Next" },
        state.annotationType !== "video"
          ? null
          : !state.videoPlaying
          ? { name: "Play" }
          : { name: "Pause" },
        { name: "Settings" },
        { name: "Fullscreen" },
        { name: "Save" },
      ].filter(Boolean)}
      onClickHeaderItem={console.log}
      onClickIconSidebarItem={console.log}
      iconSidebarItems={[
        {
          name: "select",
          helperText: "Select",
          selected: true,
        },
        {
          name: "pan",
          helperText: "Drag/Pan",
        },
        {
          name: "zoom",
          helperText: "Zoom In/Out",
        },
        {
          name: "show-tags",
          helperText: "Show / Hide Tags",
        },
        {
          name: "create-point",
          helperText: "Add Point",
        },
        {
          name: "create-box",
          helperText: "Add Bounding Box",
        },
        {
          name: "create-polygon",
          helperText: "Add Polygon",
        },
        {
          name: "create-expanding-line",
          helperText: "Add Expanding Line",
        },
        {
          name: "show-mask",
          helperText: "Show / Hide Mask",
        },
      ]}
      rightSidebarItems={[
        debugModeOn && (
          <DebugBox state={debugModeOn} lastAction={state.lastAction} />
        ),
        state.taskDescription && (
          <TaskDescription description={state.taskDescription} />
        ),
        state.labelImages && (
          <TagsSidebarBox
            currentImage={activeImage}
            imageClsList={state.imageClsList}
            imageTagList={state.imageTagList}
            onChangeImage={action("CHANGE_IMAGE", "delta")}
            expandedByDefault
          />
        ),
        (state.images?.length || 0) > 1 && (
          <ImageSelector
            onSelect={action("SELECT_REGION", "region")}
            images={state.images}
          />
        ),
        <RegionSelector
          regions={activeImage ? activeImage.regions : null}
          onSelectRegion={action("SELECT_REGION", "region")}
          onDeleteRegion={action("DELETE_REGION", "region")}
          onChangeRegion={action("CHANGE_REGION", "region")}
        />,
        state.keyframes && (
          <KeyframesSelector
            onChangeVideoTime={action("CHANGE_VIDEO_TIME", "newTime")}
            onDeleteKeyframe={action("DELETE_KEYFRAME", "time")}
            onChangeCurrentTime={action("CHANGE_VIDEO_TIME", "newTime")}
            currentTime={state.currentVideoTime}
            duration={state.videoDuration}
            keyframes={state.keyframes}
          />
        ),
        <HistorySidebarBox
          history={state.history}
          onRestoreHistory={action("RESTORE_HISTORY")}
        />,
      ].filter(Boolean)}
    >
      {canvas}
    </Workspace>
  )

  return (
    <Fullscreen
      enabled={state.fullScreen}
      onChange={(open) => {
        if (!open) {
          action("HEADER_BUTTON_CLICKED", "buttonName")("Exit Fullscreen")
        }
      }}
    >
      <HotkeyDiv
        tabIndex={-1}
        divRef={innerContainerRef}
        onMouseDown={refocusOnMouseEvent}
        onMouseOver={refocusOnMouseEvent}
        allowChanges
        handlers={hotkeyHandlers}
        className={classnames(
          classes.container,
          state.fullScreen && "Fullscreen"
        )}
      >
        <div className={classes.headerContainer}>
          <Header
            onHeaderButtonClick={action("HEADER_BUTTON_CLICKED", "buttonName")}
            videoMode={state.annotationType === "video"}
            alwaysShowNextButton={alwaysShowNextButton}
            alwaysShowPrevButton={alwaysShowPrevButton}
            inFullScreen={state.fullScreen}
            isAVideoFrame={isAVideoFrame}
            nextVideoFrameHasRegions={
              !nextImage || (nextImage.regions && nextImage.regions.length > 0)
            }
            videoDuration={state.videoDuration}
            multipleImages={state.images && state.images.length > 1}
            title={
              state.annotationType === "image"
                ? activeImage
                  ? activeImage.name
                  : "No Image Selected"
                : state.videoName || ""
            }
            onChangeCurrentTime={action("CHANGE_VIDEO_TIME", "newTime")}
            videoPlaying={state.videoPlaying}
            currentVideoTime={state.currentVideoTime}
            keyframes={state.keyframes}
          />
        </div>
        <div className={classes.workspace}>
          <div className={classes.iconToolsContainer}>
            <IconTools
              enabledTools={state.enabledTools}
              showTags={state.showTags}
              showMask={state.showMask}
              selectedTool={state.selectedTool}
              onClickTool={action("SELECT_TOOL", "selectedTool")}
            />
          </div>
          <div className={classes.imageCanvasContainer}>
            {state.annotationType === "image" && !state.selectedImage ? (
              <div className={classes.noImageSelected}>No Image Selected</div>
            ) : (
              <div style={{ height: "100%", width: "100%" }}>{canvas}</div>
            )}
          </div>
          <div className={classes.sidebarContainer}>
            <Sidebar
              debug={window.localStorage.$ANNOTATE_DEBUG_MODE && state}
              taskDescription={state.taskDescription}
              images={state.images}
              regions={activeImage ? activeImage.regions : null}
              history={state.history}
              currentImage={activeImage}
              labelImages={state.labelImages}
              imageClsList={state.imageClsList}
              imageTagList={state.imageTagList}
              keyframes={state.keyframes}
              currentVideoTime={state.currentVideoTime}
              onChangeImage={action("CHANGE_IMAGE", "delta")}
              onSelectRegion={action("SELECT_REGION", "region")}
              onDeleteRegion={action("DELETE_REGION", "region")}
              onSelectImage={action("SELECT_IMAGE", "image")}
              onChangeRegion={action("CHANGE_REGION", "region")}
              onRestoreHistory={action("RESTORE_HISTORY")}
              onChangeVideoTime={action("CHANGE_VIDEO_TIME", "newTime")}
              onDeleteKeyframe={action("DELETE_KEYFRAME", "time")}
              onShortcutActionDispatched={dispatch}
            />
          </div>
        </div>
        <SettingsDialog
          open={state.settingsOpen}
          onClose={() =>
            dispatch({
              type: "HEADER_BUTTON_CLICKED",
              buttonName: "Settings",
            })
          }
        />
      </HotkeyDiv>
    </Fullscreen>
  )
}

export default MainLayout
